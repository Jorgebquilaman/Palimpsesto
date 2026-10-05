using System.Text.RegularExpressions;
using Digesto.Application.Ingesta;

namespace Digesto.Infrastructure.Ingesta;

public partial class ExtractorMetadatosHeuristico : IExtractorMetadatos
{
    [GeneratedRegex(@"(?i)^(ORDENANZA|RESOLUCION|RESOLUCIÓN|DECLARACIÓN|DECLARACION|DISPOSICIÓN|DISPOSICION|DICTAMEN|PROVIDENCIA|ACTA|CONVENIO|ANEXO)")]
    private static partial Regex RegexTipo();

    [GeneratedRegex(@"(?i)\b(?:ORDENANZA|RESOLUCION|RESOLUCIÓN|DECLARACIÓN|DECLARACION|DISPOSICIÓN|DISPOSICION|DICTAMEN|PROVIDENCIA|ACTA|CONVENIO)\s+N?[°º.]?\s*(\d+)", RegexOptions.CultureInvariant)]
    private static partial Regex RegexNumero();

    [GeneratedRegex(@"\b(20\d{2}|19\d{2})\b")]
    private static partial Regex RegexAnio();

    [GeneratedRegex(@"(?i)\b(\d{1,2})\s+(?:DE\s+)?(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|SETIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+(?:DE\s+)?(\d{4})")]
    private static partial Regex RegexFecha();

    [GeneratedRegex(@"(?i)\bEXP(?:EDIENTE|\.|\s)[\s:.]*N?[°º]?\s*([\d\-/.]+)", RegexOptions.CultureInvariant)]
    private static partial Regex RegexExpediente();

    private static readonly Dictionary<string, string> Meses = new(StringComparer.OrdinalIgnoreCase)
    {
        ["enero"] = "01", ["febrero"] = "02", ["marzo"] = "03", ["abril"] = "04",
        ["mayo"] = "05", ["junio"] = "06", ["julio"] = "07", ["agosto"] = "08",
        ["septiembre"] = "09", ["setiembre"] = "09", ["octubre"] = "10",
        ["noviembre"] = "11", ["diciembre"] = "12",
    };

    public MetadatosSugeridos Extraer(string texto, string nombreArchivo)
    {
        var primeros = string.Join("\n", texto.Split('\n', 40)[..Math.Min(40, texto.Split('\n', 40).Length)]);

        var tipo = RegexTipo().Match(primeros) is { Success: true } t
            ? t.Groups[1].Value.ToUpperInvariant()
            : null;
        if (tipo is not null)
        {
            tipo = tipo switch
            {
                "RESOLUCION" or "RESOLUCIÓN" => "RES",
                "ORDENANZA" => "ORD",
                "DECLARACIÓN" or "DECLARACION" => "DEC",
                "DISPOSICIÓN" or "DISPOSICION" => "DIS",
                "DICTAMEN" => "DIC",
                "PROVIDENCIA" => "PRO",
                "ACTA" => "ACT",
                "CONVENIO" => "CON",
                "ANEXO" => "ANX",
                _ => tipo,
            };
        }

        var numero = RegexNumero().Match(texto) is { Success: true } n && int.TryParse(n.Groups[1].Value, out var num)
            ? num
            : (int?)null;

        var anio = RegexAnio().Match(primeros) is { Success: true } a && short.TryParse(a.Groups[1].Value, out var y)
            ? (short)y
            : (short?)null;

        DateOnly? fecha = null;
        var mFecha = RegexFecha().Match(primeros);
        if (mFecha.Success
            && Meses.TryGetValue(mFecha.Groups[2].Value, out var mes)
            && int.TryParse(mFecha.Groups[1].Value, out var dia)
            && int.TryParse(mFecha.Groups[3].Value, out var anioFecha)
            && dia is >= 1 and <= 31)
        {
            fecha = new DateOnly(anioFecha, int.Parse(mes), dia);
        }

        var expediente = RegexExpediente().Match(texto) is { Success: true } e ? e.Groups[1].Value : null;

        var tituloSugerido = tituloDesdePrimerasLineas(texto) ?? tituloDesdeNombreArchivo(nombreArchivo);

        return new MetadatosSugeridos(tipo, numero, anio, fecha, expediente, tituloSugerido);
    }

    private static string? tituloDesdePrimerasLineas(string texto)
    {
        var lineas = texto.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var linea in lineas.Take(10))
        {
            if (linea.Length is > 10 and <= 200
                && !Regex.IsMatch(linea, @"^(VISTO|CONSIDERANDO|RESUELVE|ORDENA|DECLARA|DISPONE)", RegexOptions.IgnoreCase)
                && Regex.IsMatch(linea, @"(?i)(ORDENANZA|RESOLUCION|DECLARACIÓN|DISPOSICIÓN|DICTAMEN|PROVIDENCIA|ACTA|CONVENIO)"))
            {
                return linea;
            }
        }
        return null;
    }

    private static string? tituloDesdeNombreArchivo(string nombreArchivo)
    {
        var sinExtension = Path.GetFileNameWithoutExtension(nombreArchivo);
        var conEspacios = Regex.Replace(sinExtension, @"[-_]+", " ").Trim();
        return conEspacios.Length is > 5 and <= 200 ? System.Globalization.CultureInfo.CurrentCulture.TextInfo.ToTitleCase(conEspacios.ToLowerInvariant()) : null;
    }
}
