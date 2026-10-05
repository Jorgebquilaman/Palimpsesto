using System.Text.Json;
using Digesto.Application.Ai;
using Digesto.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Digesto.Infrastructure.Ai;

public partial class AiNormaService : IAiNormaService
{
    private readonly Persistencia.DigestoDbContext _db;
    private readonly IProveedorAi _proveedor;
    private readonly Application.Archivos.IFileStorage _archivos;
    private readonly Application.Ingesta.IProcesoRunner _procesos;
    private readonly ILogger<AiNormaService> _logger;

    private const int MaxCaracteresTexto = 12000;
    private const int MaxPaginasPdf = 8;

    public AiNormaService(
        Persistencia.DigestoDbContext db,
        IProveedorAi proveedor,
        Application.Archivos.IFileStorage archivos,
        Application.Ingesta.IProcesoRunner procesos,
        ILogger<AiNormaService> logger)
    {
        _db = db;
        _proveedor = proveedor;
        _archivos = archivos;
        _procesos = procesos;
        _logger = logger;
    }

    public async Task<ResultadoCompletarAi> CompletarNormaAsync(Guid normaId, Func<EventoProgresoAi, Task>? reportar = null, CancellationToken ct = default)
    {
        async Task Reportar(string etapa, string? detalle = null)
        {
            if (reportar is not null) await reportar(new EventoProgresoAi(etapa, detalle));
        }

        var norma = await _db.Normas
            .Include(n => n.TipoNorma)
            .Include(n => n.OrganoEmisor)
            .Include(n => n.Fragmentos.OrderBy(f => f.Orden))
            .FirstOrDefaultAsync(n => n.Id == normaId, ct);

        if (norma is null)
        {
            return ResultadoCompletarAi.Falla("Norma no encontrada");
        }

        await Reportar("preparar", "Buscando el PDF original de la norma");

        List<byte[]> imagenes = [];
        var texto = string.Join("\n\n", norma.Fragmentos.Select(f => f.Texto));

        var original = await _db.NormasArchivos
            .Where(a => a.NormaId == normaId && a.Rol == Domain.Enums.RolArchivo.Original)
            .FirstOrDefaultAsync(ct);
        if (original is not null)
        {
            await Reportar("renderizar", "Renderizando las páginas del PDF como imágenes");
            var render = await RenderizarPaginasAsync(original.StorageKey, ct);
            if (render.Count > 0)
            {
                imagenes = render;
                await Reportar("consultar", $"PDF listo: {imagenes.Count} páginas como imágenes. Consultando a DeepSeek…");
            }
        }

        if (imagenes.Count == 0 && texto.Length == 0)
        {
            return ResultadoCompletarAi.Falla("El documento todavía no tiene PDF ni texto procesado; esperá al worker o reprocesá");
        }

        if (texto.Length > MaxCaracteresTexto)
        {
            texto = texto[..MaxCaracteresTexto];
        }

        var tiposDisponibles = await _db.TiposNorma
            .Where(t => t.Activo)
            .Select(t => t.Codigo)
            .ToListAsync(ct);

        var organosDisponibles = await _db.OrganosEmisores
            .Where(o => o.Activo)
            .Select(o => new { o.Codigo, o.Nombre })
            .ToListAsync(ct);

        var sistema = """
            Sos un asistente que completa metadatos de normas institucionales de una universidad
            argentina (IUPA). Recibís las páginas del PDF original (imágenes) y, opcionalmente,
            el texto extraído. Devolvés SOLO un objeto JSON
            válido (sin texto adicional), con estas claves:
            {
              "tipo_norma": código del tipo (de la lista provista),
              "numero": entero, "anio": entero, "sufijo": null o texto corto,
              "titulo": máx 200 caracteres, descriptivo, sin el número ni el tipo,
              "resumen": 2 a 4 oraciones en español rioplatense que resuman qué establece la norma,
              "palabras_clave": array de 3 a 8 términos,
              "expediente": null o texto,
              "fecha_sancion": "YYYY-MM-DD" o null,
              "organo": código del órgano emisor (de la lista provista; si no se deduce, null),
              "vigencia": "vigente" | "modificada" | "derogada" | "derogada_parcialmente" | "deja_sin_efecto",
              "citas": array de normas que esta menciona (modifica, deroga, reglamenta, ratifica, deja sin efecto o complementa),
                cada una como { "tipo": código, "numero": entero, "anio": entero, "tipo_relacion": "modifica|deroga|derogaparcialmente|reglamenta|complementa|ratifica|dejainsineffecto" }
            }
            Si un dato no aparece en el texto, usá null (o array vacío para citas). No inventes datos.
            PROHIBIDO inventar información: basate únicamente en lo que se ve en el documento.
            - El resumen solo puede afirmar lo que el documento establece; no menciones artículos,
              plazos, montos, plazos ni números de artículo que no figuren literalmente en el documento.
            - Si la norma no tiene artículos, no menciones artículos en el resumen.
            - No uses conocimiento externo ni suposiciones: si algo no está, null.
            """;

        var usuario = $"""
            Tipos de norma disponibles: {string.Join(", ", tiposDisponibles)}
            Órganos disponibles: {string.Join("; ", organosDisponibles.Select(o => $"{o.Codigo} = {o.Nombre}"))}
            {(imagenes.Count > 0 ? $"Te adjunto {imagenes.Count} imágenes de las páginas del PDF original; analizá el documento directamente." : "")}

            {(imagenes.Count == 0 ? $"TEXTO DE LA NORMA:\n{texto}" : (texto.Length > 0 ? $"Texto extraído de referencia (puede tener errores de OCR):\n{texto}" : ""))}
            """;

        string crudo;
        try
        {
            await Reportar("consultar", imagenes.Count > 0
                ? "DeepSeek está leyendo el documento original"
                : "DeepSeek está leyendo el texto extraído");
            crudo = imagenes.Count > 0
                ? await _proveedor.CompletarConImagenesAsync(sistema, usuario, imagenes, TimeSpan.FromSeconds(300), ct)
                : await _proveedor.CompletarAsync(sistema, usuario, TimeSpan.FromSeconds(150), ct);
            await Reportar("aplicar", "Aplicando los datos deducidos a la norma");
        }
        catch (InvalidOperationException ex)
        {
            return ResultadoCompletarAi.Falla(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error inesperado llamando a la AI");
            return ResultadoCompletarAi.Falla("No se pudo contactar a la AI");
        }

        DatosAi datos;
        try
        {
            datos = ParsearRespuesta(crudo);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Respuesta de AI no parseable: {Crudo}", Truncar(crudo, 300));
            return ResultadoCompletarAi.Falla("La AI devolvió una respuesta que no se pudo interpretar");
        }

        var advertencias = new List<string>();
        var aplicados = await AplicarDatosAsync(norma, datos, advertencias, ct);
        var relacionesCreadas = await CrearRelacionesAsync(norma, datos, ct);

        if (norma.Numero > 0)
        {
            norma.CodigoNormalizado = Domain.Reglas.CodigoNormalizador.Armar(
                norma.TipoNorma.Codigo, norma.OrganoEmisor.Codigo, norma.Anio, norma.Numero);
        }

        if (norma.EstadoPublicacion is EstadoPublicacion.Borrador or EstadoPublicacion.Procesando)
        {
            norma.EstadoPublicacion = EstadoPublicacion.EnRevision;
        }

        norma.ActualizadoEn = DateTime.UtcNow;
        norma.ActualizadoPor = "ai";
        await _db.SaveChangesAsync(ct);

        return new ResultadoCompletarAi(true, datos, aplicados, relacionesCreadas, advertencias);
    }

    internal static DatosAi ParsearRespuesta(string crudo)
    {
        var limpio = crudo.Trim();
        var cerca = limpio.IndexOf('{');
        var fin = limpio.LastIndexOf('}');
        if (cerca >= 0 && fin > cerca)
        {
            limpio = limpio[cerca..(fin + 1)];
        }

        using var documento = JsonDocument.Parse(limpio);
        var raiz = documento.RootElement;

        string? Cadena(string clave)
        {
            if (raiz.TryGetProperty(clave, out var v) && v.ValueKind == JsonValueKind.String)
            {
                var texto = v.GetString();
                return string.IsNullOrWhiteSpace(texto) ? null : texto;
            }
            return null;
        }

        int? Entero(string clave)
        {
            if (raiz.TryGetProperty(clave, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var e))
            {
                return e;
            }
            return null;
        }

        short? EnteroCorto(string clave)
        {
            if (raiz.TryGetProperty(clave, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt16(out var e))
            {
                return e;
            }
            return null;
        }

        DateOnly? Fecha(string clave)
        {
            var texto = Cadena(clave);
            return DateOnly.TryParse(texto, out var f) ? f : null;
        }

        string[]? Lista(string clave)
        {
            if (raiz.TryGetProperty(clave, out var v) && v.ValueKind == JsonValueKind.Array)
            {
                return v.EnumerateArray()
                    .Where(e => e.ValueKind == JsonValueKind.String)
                    .Select(e => e.GetString() ?? "")
                    .Where(t => t.Length > 0)
                    .ToArray();
            }
            return null;
        }

        var citas = new List<CitaDetectadaAi>();
        if (raiz.TryGetProperty("citas", out var citasEl) && citasEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var citaEl in citasEl.EnumerateArray())
            {
                if (citaEl.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }
                var tipo = citaEl.TryGetProperty("tipo", out var t) && t.ValueKind == JsonValueKind.String ? t.GetString() : null;
                var numero = citaEl.TryGetProperty("numero", out var n) && n.ValueKind == JsonValueKind.Number && n.TryGetInt32(out var num) ? num : 0;
                var anio = citaEl.TryGetProperty("anio", out var a) && a.ValueKind == JsonValueKind.Number && a.TryGetInt16(out var an) ? an : (short)0;
                var relacion = citaEl.TryGetProperty("tipo_relacion", out var r) && r.ValueKind == JsonValueKind.String ? r.GetString() : null;

                if (!string.IsNullOrWhiteSpace(tipo) && numero > 0 && anio > 1900)
                {
                    citas.Add(new CitaDetectadaAi(tipo!, numero, anio, relacion));
                }
            }
        }

        return new DatosAi(
            Cadena("tipo_norma"),
            Entero("numero"),
            EnteroCorto("anio"),
            Cadena("sufijo"),
            Cadena("titulo"),
            Cadena("resumen"),
            Lista("palabras_clave"),
            Cadena("expediente"),
            Fecha("fecha_sancion"),
            Cadena("organo"),
            Cadena("vigencia"),
            citas);
    }

    private async Task<List<byte[]>> RenderizarPaginasAsync(string storageKey, CancellationToken ct)
    {
        var temporal = Path.Combine(Path.GetTempPath(), $"ai-{Guid.NewGuid():N}.pdf");
        try
        {
            await using (var flujo = await _archivos.AbrirAsync(storageKey, ct))
            {
                await using var destino = File.Create(temporal);
                await flujo.CopyToAsync(destino, ct);
            }

            var directorio = Path.Combine(Path.GetTempPath(), $"ai-{Guid.NewGuid():N}");
            Directory.CreateDirectory(directorio);

            var resultado = await _procesos.EjecutarAsync(
                "pdftoppm",
                ["-png", "-r", "150", "-f", "1", "-l", MaxPaginasPdf.ToString(), temporal, Path.Combine(directorio, "pagina")],
                TimeSpan.FromSeconds(120),
                ct);

            if (!resultado.Ok)
            {
                _logger.LogWarning("pdftoppm falló ({Codigo}): {Error}", resultado.CodigoSalida, Truncar(resultado.Error, 300));
                return [];
            }

            var imagenes = Directory.GetFiles(directorio, "pagina-*.png")
                .OrderBy(f => f)
                .Select(File.ReadAllBytes)
                .ToList();
            _logger.LogInformation("AI: PDF renderizado a {Paginas} imágenes", imagenes.Count);
            return imagenes;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo renderizar el PDF para la AI");
            return [];
        }
        finally
        {
            try
            {
                if (File.Exists(temporal)) File.Delete(temporal);
                var dir = Path.Combine(Path.GetTempPath());
            }
            catch
            {
            }
        }
    }

    private async Task<List<string>> AplicarDatosAsync(Domain.Entidades.Norma norma, DatosAi datos, List<string> advertencias, CancellationToken ct)
    {
        var aplicados = new List<string>();

        // identidad propuesta (tipo+organo+numero+anio): no puede pisar una norma existente
        var tipoPropuesto = datos.TipoNormaCodigo is { Length: > 0 } tc0
            ? await _db.TiposNorma.FirstOrDefaultAsync(t => t.Codigo == tc0.ToUpperInvariant(), ct)
            : null;
        var organoPropuesto = datos.OrganoCodigo is { Length: > 0 } oc0
            ? await _db.OrganosEmisores.FirstOrDefaultAsync(o => o.Codigo == oc0.ToUpperInvariant(), ct)
            : null;
        var numeroPropuesto = datos.Numero is { } n0 && n0 > 0 ? n0 : norma.Numero;
        var anioPropuesto = datos.Anio is { } a0 && a0 >= 1900 ? a0 : norma.Anio;

        if (numeroPropuesto > 0 && tipoPropuesto is not null && organoPropuesto is not null)
        {
            var otraMisma = await _db.Normas.FirstOrDefaultAsync(x =>
                x.Id != norma.Id &&
                x.TipoNormaId == tipoPropuesto.Id &&
                x.OrganoEmisorId == organoPropuesto.Id &&
                x.Numero == numeroPropuesto &&
                x.Anio == anioPropuesto, ct);
            if (otraMisma is not null)
            {
                advertencias.Add($"La identidad {tipoPropuesto.Codigo}-{organoPropuesto.Codigo}-{anioPropuesto}-{numeroPropuesto:0000} ya la tiene {otraMisma.CodigoNormalizado}; no se cambió el número (¿duplicado?). Revisá el listado.");
                tipoPropuesto = null;
                organoPropuesto = null;
                numeroPropuesto = norma.Numero;
                anioPropuesto = norma.Anio;
            }
        }

        if (tipoPropuesto is not null && tipoPropuesto.Id != norma.TipoNormaId)
        {
            norma.TipoNormaId = tipoPropuesto.Id;
            aplicados.Add("tipo_norma");
        }
        if (organoPropuesto is not null && organoPropuesto.Id != norma.OrganoEmisorId)
        {
            norma.OrganoEmisorId = organoPropuesto.Id;
            aplicados.Add("organo");
        }
        if (numeroPropuesto is { } np && np > 0 && np != norma.Numero)
        {
            norma.Numero = np;
            aplicados.Add("numero");
        }
        if (anioPropuesto is { } ap && ap >= 1900 && ap != norma.Anio)
        {
            norma.Anio = ap;
            aplicados.Add("anio");
        }
        if (datos.Titulo is { Length: > 3 } t)
        {
            norma.Titulo = t.Length <= 500 ? t : t[..500];
            aplicados.Add("titulo");
        }
        if (datos.Resumen is { Length: > 20 } r)
        {
            norma.Resumen = r;
            aplicados.Add("resumen");
        }
        if (datos.PalabrasClave is { Length: > 0 } pk)
        {
            norma.PalabrasClave = pk;
            aplicados.Add("palabras_clave");
        }
        if (datos.Expediente is { Length: > 0 } e)
        {
            norma.Expediente = e.Length <= 50 ? e : e[..50];
            aplicados.Add("expediente");
        }
        if (datos.FechaSancion is { } f)
        {
            norma.FechaSancion = f;
            aplicados.Add("fecha_sancion");
        }
        if (datos.Vigencia is { } v)
        {
            try
            {
                if (Enum.TryParse<Domain.Enums.Vigencia>(NormalizarEnum(v), ignoreCase: true, out var vig))
                {
                    norma.Vigencia = vig;
                    aplicados.Add("vigencia");
                }
            }
            catch
            {
            }
        }

        return aplicados;
    }

    private async Task<List<RelacionCreadaAi>> CrearRelacionesAsync(
        Domain.Entidades.Norma norma,
        DatosAi datos,
        CancellationToken ct)
    {
        var creadas = new List<RelacionCreadaAi>();
        var tipoPorCodigo = await _db.TiposNorma.ToDictionaryAsync(t => t.Codigo, t => t.Id, ct);

        foreach (var cita in datos.Citas)
        {
            var tipoDestinoId = tipoPorCodigo.TryGetValue(cita.Tipo.ToUpperInvariant(), out var idDestino) ? idDestino : (int?)null;
            if (tipoDestinoId is null)
            {
                continue;
            }

            var destino = await _db.Normas.FirstOrDefaultAsync(
                n => n.TipoNormaId == tipoDestinoId && n.Numero == cita.Numero && n.Anio == cita.Anio, ct);
            if (destino is null || destino.Id == norma.Id)
            {
                continue;
            }

            if (!Enum.TryParse<Domain.Enums.TipoRelacion>(NormalizarEnum(cita.TipoRelacion ?? "modifica"), ignoreCase: true, out var tipoRelacion))
            {
                tipoRelacion = Domain.Enums.TipoRelacion.Modifica;
            }

            var yaExiste = await _db.NormasRelaciones.AnyAsync(
                r => r.NormaOrigenId == norma.Id && r.NormaDestinoId == destino.Id && r.Tipo == tipoRelacion, ct);
            if (yaExiste)
            {
                continue;
            }

            _db.NormasRelaciones.Add(new Domain.Entidades.NormaRelacion
            {
                NormaOrigenId = norma.Id,
                NormaDestinoId = destino.Id,
                Tipo = tipoRelacion,
                Detalle = "Detectada por AI",
            });
            creadas.Add(new RelacionCreadaAi(destino.CodigoNormalizado, tipoRelacion.ToString().ToLowerInvariant()));
        }

        return creadas;
    }

    private static string NormalizarEnum(string valor) =>
        valor.Trim().ToLowerInvariant().Replace(' ', '_').Replace('-', '_');

    private static string Truncar(string texto, int largo) => texto.Length <= largo ? texto : texto[..largo];
}
