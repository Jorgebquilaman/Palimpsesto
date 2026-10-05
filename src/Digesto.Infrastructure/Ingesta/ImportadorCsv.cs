namespace Digesto.Infrastructure.Ingesta;

public partial class ImportadorCsv : Application.Ingesta.IImportadorCsv
{
    private static readonly string[] ColumnasEsperadas =
    [
        "archivo", "tipo", "numero", "anio", "sufijo", "titulo",
        "fecha_sancion", "fecha_publicacion", "visibilidad", "vigencia",
        "resumen", "expediente", "palabras_clave",
    ];

    public List<Application.Ingesta.FilaImportacion> Parsear(string contenidoCsv)
    {
        var letras = new List<Application.Ingesta.FilaImportacion>();
        var lineas = CsvLexer(contenidoCsv);

        if (lineas.Count == 0)
        {
            return letras;
        }

        var cabecera = lineas[0].Select(c => c.Trim().ToLowerInvariant().Replace(' ', '_')).ToList();
        var indices = ColumnasEsperadas.ToDictionary(c => c, c => cabecera.IndexOf(c));

        if (indices["archivo"] < 0)
        {
            throw new InvalidOperationException("El CSV debe incluir la columna 'archivo'");
        }

        foreach (var campos in lineas.Skip(1))
        {
            if (campos.Count == 1 && string.IsNullOrWhiteSpace(campos[0]))
            {
                continue;
            }

            string Valor(string columna)
            {
                var i = indices[columna];
                return i >= 0 && i < campos.Count ? campos[i].Trim() : "";
            }

            var archivo = Valor("archivo");
            if (archivo.Length == 0)
            {
                continue;
            }

            letras.Add(new Application.Ingesta.FilaImportacion(
                Archivo: archivo,
                TipoCodigo: Valor("tipo") is { Length: > 0 } t ? t.ToUpperInvariant() : null,
                Numero: int.TryParse(Valor("numero"), out var numero) ? numero : null,
                Anio: short.TryParse(Valor("anio"), out var anio) ? anio : null,
                Sufijo: Valor("sufijo") is { Length: > 0 } s ? s : null,
                Titulo: Valor("titulo") is { Length: > 0 } ti ? ti : null,
                FechaSancion: Valor("fecha_sancion") is { Length: > 0 } fs ? fs : null,
                FechaPublicacion: Valor("fecha_publicacion") is { Length: > 0 } fp ? fp : null,
                Visibilidad: Valor("visibilidad") is { Length: > 0 } v ? v : null,
                Vigencia: Valor("vigencia") is { Length: > 0 } vg ? vg : null,
                Resumen: Valor("resumen") is { Length: > 0 } r ? r : null,
                Expediente: Valor("expediente") is { Length: > 0 } e ? e : null,
                PalabrasClave: Valor("palabras_clave") is { Length: > 0 } pk
                    ? pk.Split(';', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
                    : null));
        }

        return letras;
    }

    /// <summary>Divide el CSV en filas de campos respetando comillas dobles (RFC 4180 básico).</summary>
    private static List<List<string>> CsvLexer(string contenido)
    {
        var filas = new List<List<string>>();
        var campos = new List<string>();
        var campo = new System.Text.StringBuilder();
        var enComillas = false;

        for (var i = 0; i < contenido.Length; i++)
        {
            var c = contenido[i];
            if (enComillas)
            {
                if (c == '"')
                {
                    if (i + 1 < contenido.Length && contenido[i + 1] == '"')
                    {
                        campo.Append('"');
                        i++;
                    }
                    else
                    {
                        enComillas = false;
                    }
                }
                else
                {
                    campo.Append(c);
                }
            }
            else if (c == '"')
            {
                enComillas = true;
            }
            else if (c == ',')
            {
                campos.Add(campo.ToString());
                campo.Clear();
            }
            else if (c is '\n' or '\r')
            {
                if (c == '\r' && i + 1 < contenido.Length && contenido[i + 1] == '\n')
                {
                    i++;
                }
                campos.Add(campo.ToString());
                campo.Clear();
                if (campos.Count > 1 || campos[0].Length > 0)
                {
                    filas.Add(campos);
                }
                campos = new List<string>();
            }
            else
            {
                campo.Append(c);
            }
        }

        if (campo.Length > 0 || campos.Count > 0)
        {
            campos.Add(campo.ToString());
            filas.Add(campos);
        }

        return filas;
    }
}
