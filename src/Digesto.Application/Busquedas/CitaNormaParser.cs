using System.Text.RegularExpressions;

namespace Digesto.Application.Busquedas;

public enum ModoBusqueda
{
    Todas = 1,
    Cualquiera = 2,
    Frase = 3,
}

public enum OrdenBusqueda
{
    Relevancia = 1,
    FechaDesc = 2,
    FechaAsc = 3,
}

public record CitaDetectada(string TipoCodigo, int Numero, short Anio);

public static partial class CitaNormaParser
{
    [GeneratedRegex(@"^\s*([A-Za-z]{3,4})[.\s\-=]*(\d{1,6})\s*[-/]\s*(\d{4})\s*$")]
    private static partial Regex RegexCitaCorta();

    [GeneratedRegex(@"^\s*([A-Z]{2,4})-([A-Z]{2,4})-(\d{4})-(\d{1,6})\s*$")]
    private static partial Regex RegexCodigoNormalizado();

    /// <summary>Detecta si la consulta es una cita como "Res. 123/2024", "Ord 45-2023" o "RES-CS-2024-0123".</summary>
    public static CitaDetectada? Parsear(string? consulta)
    {
        if (string.IsNullOrWhiteSpace(consulta))
        {
            return null;
        }

        var citaCorta = RegexCitaCorta().Match(consulta);
        if (citaCorta.Success)
        {
            return new CitaDetectada(
                NormalizarTipo(citaCorta.Groups[1].Value),
                int.Parse(citaCorta.Groups[2].Value),
                short.Parse(citaCorta.Groups[3].Value));
        }

        var codigo = RegexCodigoNormalizado().Match(consulta);
        if (codigo.Success)
        {
            return new CitaDetectada(
                codigo.Groups[1].Value.ToUpperInvariant(),
                int.Parse(codigo.Groups[4].Value),
                short.Parse(codigo.Groups[3].Value));
        }

        return null;
    }

    private static string NormalizarTipo(string entrada)
    {
        var limpio = entrada.TrimEnd('.').ToUpperInvariant();
        return limpio switch
        {
            "RES" => "RES",
            "ORD" => "ORD",
            "DEC" => "DEC",
            "DIS" => "DIS",
            "DIC" => "DIC",
            "PRO" => "PRO",
            "ACT" => "ACT",
            "CON" => "CON",
            "ANX" => "ANX",
            "RESOL" => "RES",
            "ORDEN" => "ORD",
            "DECLAR" => "DEC",
            "DISPOS" => "DIS",
            "DICTA" => "DIC",
            "PROVID" => "PRO",
            _ => limpio.Length <= 4 ? limpio : limpio[..4],
        };
    }
}
