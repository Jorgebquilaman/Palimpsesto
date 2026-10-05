using System.Text;
using System.Text.RegularExpressions;

namespace Digesto.Infrastructure.Ingesta;

public static partial class NormalizadorTexto
{
    [GeneratedRegex(@"(\p{Ll})-\s*\r?\n\s*(\p{Ll})")]
    private static partial Regex RegexPalabraCortada();

    [GeneratedRegex(@"\r\n|\r")]
    private static partial Regex RegexSaltos();

    [GeneratedRegex(@"[ \t]{2,}")]
    private static partial Regex RegexEspacios();

    [GeneratedRegex(@"\n{3,}")]
    private static partial Regex RegexSaltosMultiples();

    public static string Normalizar(string texto)
    {
        var resultado = texto.Normalize(NormalizationForm.FormC);
        resultado = resultado.Replace('\u00AD', ' ');
        resultado = RegexPalabraCortada().Replace(resultado, "$1$2");
        resultado = RegexSaltos().Replace(resultado, "\n");
        resultado = RegexEspacios().Replace(resultado, " ");
        resultado = RegexSaltosMultiples().Replace(resultado, "\n\n");
        return resultado.Trim();
    }

    public static double PromedioCaracteresAlfabeticos(List<(int Pagina, string Texto)> paginas)
    {
        if (paginas.Count == 0)
        {
            return 0;
        }
        var total = 0.0;
        foreach (var (_, texto) in paginas)
        {
            total += texto.Count(char.IsLetter);
        }
        return total / paginas.Count;
    }
}
