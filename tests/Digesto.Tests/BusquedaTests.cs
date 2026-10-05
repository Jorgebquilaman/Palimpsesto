using Dapper;
using Digesto.Application.Busquedas;
using Digesto.Domain.Entidades;
using Digesto.Domain.Enums;
using Digesto.Infrastructure;
using Digesto.Infrastructure.Persistencia;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Digesto.Tests;

public class BusquedaTests : IClassFixture<MigracionYBusquedaFixture>
{
    private static readonly SemaphoreSlim SemillaLock = new(1, 1);
    private static ServiceProvider? _compartido;
    private readonly MigracionYBusquedaFixture _fixture;

    public BusquedaTests(MigracionYBusquedaFixture fixture)
    {
        _fixture = fixture;
    }

    private async Task<ServiceProvider> PrepararAsync()
    {
        if (_compartido is not null)
        {
            return _compartido;
        }

        await SemillaLock.WaitAsync();
        try
        {
            if (_compartido is not null)
            {
                return _compartido;
            }

            var services = new ServiceCollection();
            services.AddLogging();
            services.AddDigestoInfrastructure(_fixture.CadenaConexion, Path.Combine(Path.GetTempPath(), "digesto-busq-" + Guid.NewGuid().ToString("N")[..8]));

            _compartido = services.BuildServiceProvider();

            var db = _compartido.GetRequiredService<DigestoDbContext>();
            await db.Database.MigrateAsync();

            var tipoRes = await db.TiposNorma.FirstOrDefaultAsync(t => t.Codigo == "RES");
            var tipoOrd = await db.TiposNorma.FirstOrDefaultAsync(t => t.Codigo == "ORD");
            var organo = await db.OrganosEmisores.FirstOrDefaultAsync(o => o.Codigo == "CS");

            if (tipoRes is null)
            {
                tipoRes = new TipoNorma { Codigo = "RES", Nombre = "Resolución" };
                tipoOrd = new TipoNorma { Codigo = "ORD", Nombre = "Ordenanza" };
                organo = new OrganoEmisor { Codigo = "CS", Nombre = "Consejo Superior" };
                db.TiposNorma.AddRange(tipoRes, tipoOrd);
                db.OrganosEmisores.Add(organo);
                await db.SaveChangesAsync();
            }

            await CrearNormaAsync(db, tipoRes, organo!, 123, 2024, "Resolución de becas de extensión", Visibilidad.Publica, EstadoPublicacion.Publicada,
                "Otorgar becas de extensión universitaria a los estudiantes que presenten proyectos comunitarios.");

            await CrearNormaAsync(db, tipoRes, organo!, 124, 2024, "Resolución de concursos docentes", Visibilidad.Publica, EstadoPublicacion.Publicada,
                "Llamar a concursos docentes para cubrir cátedras vacantes de la universidad.");

            await CrearNormaAsync(db, tipoOrd!, organo!, 5, 2023, "Ordenanza de régimen académico", Visibilidad.Publica, EstadoPublicacion.Publicada,
                "Establecer el régimen de cursada y evaluación de las carreras de grado.");

            await CrearNormaAsync(db, tipoRes, organo!, 100, 2025, "Resolución reservada sobre presupuesto", Visibilidad.Reservada, EstadoPublicacion.Publicada,
                "Asignación reservada del presupuesto institucional con datos sensibles.");

            await CrearNormaAsync(db, tipoRes, organo!, 101, 2025, "Resolución interna de comisión", Visibilidad.Interna, EstadoPublicacion.Publicada,
                "Cuestiones internas de la comisión de presupuesto.");

            return _compartido;
        }
        finally
        {
            SemillaLock.Release();
        }
    }

    private static async Task CrearNormaAsync(
        DigestoDbContext db,
        TipoNorma tipo,
        OrganoEmisor organo,
        int numero,
        short anio,
        string titulo,
        Visibilidad visibilidad,
        EstadoPublicacion estado,
        string textoFragmento)
    {
        var norma = new Norma
        {
            Id = Guid.NewGuid(),
            TipoNormaId = tipo.Id,
            OrganoEmisorId = organo.Id,
            Numero = numero,
            Anio = anio,
            CodigoNormalizado = $"{tipo.Codigo}-{organo.Codigo}-{anio}-{numero:D4}",
            Titulo = titulo,
            FechaSancion = new DateOnly(anio, 1, 15),
            Visibilidad = visibilidad,
            EstadoPublicacion = estado,
            TextoOrigen = TextoOrigen.Nativo,
            CreadoEn = DateTime.UtcNow,
            CreadoPor = "test",
        };
        db.Normas.Add(norma);
        db.NormasFragmentos.Add(new NormaFragmento
        {
            NormaId = norma.Id,
            Orden = 1,
            Tipo = TipoFragmento.Articulo,
            Etiqueta = "Artículo 1º",
            Texto = textoFragmento,
        });
        await db.SaveChangesAsync();
    }

    private static IBuscadorNormas Buscador(ServiceProvider services) =>
        services.GetRequiredService<IBuscadorNormas>();

    private static FiltrosBusqueda Filtros(
        string? q = null,
        ModoBusqueda modo = ModoBusqueda.Todas,
        int? numero = null,
        short? anio = null,
        int? tipoId = null,
        int? organoId = null,
        DateOnly? desde = null,
        DateOnly? hasta = null,
        Vigencia? vigencia = null)
    {
        return new FiltrosBusqueda(q, modo, numero, anio, tipoId, organoId, desde, hasta, vigencia, "relevancia", 1, 20);
    }

    [Fact]
    public async Task Buscar_SinAcentos_Coincide()
    {
        var services = await PrepararAsync();
        var resultado = await Buscador(services).BuscarAsync(Filtros(q: "becas extension"));

        Assert.Contains(resultado.Items, i => i.Codigo.Contains("2024-0123"));
        Assert.Equal(1, resultado.Total);
    }

    [Fact]
    public async Task Buscar_PluralYStemming_Coincide()
    {
        var services = await PrepararAsync();
        var resultado = await Buscador(services).BuscarAsync(Filtros(q: "resoluciones"));

        Assert.Equal(2, resultado.Total);
    }

    [Fact]
    public async Task Buscar_FraseExacta_SoloLiterales()
    {
        var services = await PrepararAsync();
        var conFrase = await Buscador(services).BuscarAsync(Filtros(q: "becas de extension", modo: ModoBusqueda.Frase));
        Assert.Equal(1, conFrase.Total);

        var sinFrase = await Buscador(services).BuscarAsync(Filtros(q: "becas comunitarios", modo: ModoBusqueda.Frase));
        Assert.Equal(0, sinFrase.Total);
    }

    [Fact]
    public async Task Buscar_Websearch_OrYExclusion()
    {
        var services = await PrepararAsync();

        var conOr = await Buscador(services).BuscarAsync(Filtros(q: "becas or concursos"));
        Assert.Equal(2, conOr.Total);

        var conExclusion = await Buscador(services).BuscarAsync(Filtros(q: "becas -extensión"));
        Assert.Equal(0, conExclusion.Total);
    }

    [Fact]
    public async Task Buscar_FiltrosCombinados()
    {
        var services = await PrepararAsync();

        var porNumeroAnio = await Buscador(services).BuscarAsync(Filtros(numero: 123, anio: 2024));
        Assert.Equal(1, porNumeroAnio.Total);
        Assert.Equal("RES-CS-2024-0123", porNumeroAnio.Items[0].Codigo);

        var porRango = await Buscador(services).BuscarAsync(Filtros(desde: new DateOnly(2024, 6, 1)));
        Assert.Equal(0, porRango.Total);

        var porRangoVigente = await Buscador(services).BuscarAsync(Filtros(desde: new DateOnly(2024, 1, 1), hasta: new DateOnly(2024, 12, 31)));
        Assert.Equal(2, porRangoVigente.Total);
    }

    [Fact]
    public async Task Buscar_NoFugaReservadasNiInternas()
    {
        var services = await PrepararAsync();

        var conQ = await Buscador(services).BuscarAsync(Filtros(q: "presupuesto"));
        Assert.Equal(0, conQ.Total);

        var sinQ = await Buscador(services).BuscarAsync(Filtros());
        Assert.Equal(3, sinQ.Total);
        Assert.DoesNotContain(sinQ.Items, i => i.Codigo == "RES-CS-2025-0100");
        Assert.DoesNotContain(sinQ.Items, i => i.Codigo == "RES-CS-2025-0101");

        var facetas = sinQ.Facetas;
        Assert.Equal(3, facetas.Tipos.Sum(t => t.Cantidad));

        var tipoRes = facetas.Tipos.Single(t => t.Nombre == "Resolución");
        Assert.Equal(2, tipoRes.Cantidad);

        var tipoOrd = facetas.Tipos.Single(t => t.Nombre == "Ordenanza");
        Assert.Equal(1, tipoOrd.Cantidad);

        Assert.Contains(facetas.Anios, a => a.Nombre == "2024" && a.Cantidad == 2);
        Assert.Contains(facetas.Anios, a => a.Nombre == "2023" && a.Cantidad == 1);
    }

    [Fact]
    public async Task Buscar_SnippetConResaltado()
    {
        var services = await PrepararAsync();
        var resultado = await Buscador(services).BuscarAsync(Filtros(q: "becas"));

        var item = resultado.Items.Single();
        Assert.NotNull(item.Snippet);
        Assert.Contains("<mark>", item.Snippet!);
        Assert.Contains("becas", item.Snippet!);
    }

    [Fact]
    public async Task Buscar_PorCitaDirecta()
    {
        var services = await PrepararAsync();

        var cita = await Buscador(services).BuscarAsync(Filtros(q: "Res. 123/2024"));
        Assert.Equal("RES-CS-2024-0123", cita.CodigoCitaDirecta);

        var ordenanza = await Buscador(services).BuscarAsync(Filtros(q: "Ord 5-2023"));
        Assert.Equal("ORD-CS-2023-0005", ordenanza.CodigoCitaDirecta);
    }

    [Fact]
    public async Task Sugerencias_TituloYCodigo()
    {
        var services = await PrepararAsync();
        var sugerencias = services.GetRequiredService<ISugerenciasNormas>();

        var porTitulo = await sugerencias.SugerirAsync("becas");
        Assert.Contains(porTitulo, s => s.Codigo == "RES-CS-2024-0123");

        var porCodigo = await sugerencias.SugerirAsync("RES-CS-2024");
        Assert.Contains(porCodigo, s => s.Codigo == "RES-CS-2024-0123");

        var typos = await sugerencias.SugerirAsync("beca");
        Assert.Contains(typos, s => s.Codigo == "RES-CS-2024-0123");

        var noFuga = await sugerencias.SugerirAsync("presupuesto");
        Assert.Empty(noFuga);
    }

    [Fact]
    public async Task Busqueda_UsaIndicesGin()
    {
        var services = await PrepararAsync();

        var db = services.GetRequiredService<DigestoDbContext>();
        var con = (Npgsql.NpgsqlConnection)db.Database.GetDbConnection();
        if (con.State != System.Data.ConnectionState.Open)
        {
            await con.OpenAsync();
        }

        await using var transaccion = await con.BeginTransactionAsync();

        await con.ExecuteAsync("SET LOCAL enable_seqscan = off;", transaction: transaccion);

        var plan = await con.QueryFirstOrDefaultAsync<string>(
            "EXPLAIN (FORMAT TEXT) SELECT f.id FROM norma_fragmento f WHERE f.tsv_es @@ websearch_to_tsquery('spanish', f_unaccent('becas'))", transaction: transaccion);

        Assert.Contains("Bitmap", plan);
        Assert.Contains("norma_fragmento", plan);
        Assert.DoesNotContain("Seq Scan", plan);
    }
}
