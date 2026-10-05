using System.Text;
using System.Text.RegularExpressions;
using Digesto.Application.Ingesta;

namespace Digesto.Infrastructure.Ingesta;

public partial class GeneradorHtmlFragmentos
{
    [GeneratedRegex(@"^\s*([a-z])\)\s+(.*)$", RegexOptions.IgnoreCase)]
    private static partial Regex RegexInciso();

    [GeneratedRegex(@"^\s*(\d+)\s*\)\s+(.*)$")]
    private static partial Regex RegexIncisoNumerico();

    private static readonly Regex RegexEtiqueta = new(@"^(ART[ÍI]CULO\s*N?[°º.]?\s*\d+[°º]?|ANEXO\s+[IVXLC\d]+|VISTO|VISTOS|CONSIDERANDO|CONSIDERANDOS|RESUELVE|ORDENA|DECLARA|DISPONE)\s*[.:\-—·]?\s*", RegexOptions.IgnoreCase);

    public static List<(string Html, string Texto)> GenerarHtml(List<FragmentoSugerido> fragmentos, string codigoNormalizado)
    {
        var resultado = new List<(string, string)>(fragmentos.Count);

        foreach (var fragmento in fragmentos)
        {
            var texto = fragmento.Texto;
            var html = new StringBuilder();

            if (fragmento.Tipo == Domain.Enums.TipoFragmento.Articulo && fragmento.Etiqueta is not null)
            {
                var numeroArticulo = Regex.Match(fragmento.Etiqueta, @"\d+").Value;
                var sinEtiqueta = RegexEtiqueta.Match(texto) is { Success: true } m
                    ? texto[m.Length..].Trim()
                    : texto;
                html.Append($"""<h2 id="art-{numeroArticulo}">{Escapar(fragmento.Etiqueta)}</h2>""");
                html.Append(GenerarCuerpo(sinEtiqueta));
            }
            else if (fragmento.Tipo is Domain.Enums.TipoFragmento.Encabezado
                     or Domain.Enums.TipoFragmento.Visto
                     or Domain.Enums.TipoFragmento.Considerando
                     or Domain.Enums.TipoFragmento.ParteDispositiva)
            {
                html.Append($"""<h3>{Escapar(fragmento.Etiqueta ?? fragmento.Tipo.ToString())}</h3>""");
                html.Append(GenerarCuerpo(texto));
            }
            else
            {
                html.Append(GenerarCuerpo(texto));
            }

            resultado.Add((html.ToString(), texto));
        }

        return resultado;
    }

    private static string GenerarCuerpo(string texto)
    {
        var html = new StringBuilder();
        var parrafoActual = new StringBuilder();
        var incisosAbiertos = false;

        void CerrarParrafo()
        {
            if (parrafoActual.Length > 0)
            {
                if (incisosAbiertos)
                {
                    html.Append("</ol>\n");
                    incisosAbiertos = false;
                }
                html.Append($"<p>{Escapar(parrafoActual.ToString())}</p>\n");
                parrafoActual.Clear();
            }
        }

        foreach (var linea in texto.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var inciso = RegexInciso().Match(linea);
            var incisoNumerico = RegexIncisoNumerico().Match(linea);

            if (inciso.Success || incisoNumerico.Success)
            {
                CerrarParrafo();
                if (!incisosAbiertos)
                {
                    html.Append("<ol style=\"list-style-type: none;\">\n");
                    incisosAbiertos = true;
                }
                var etiqueta = inciso.Success ? inciso.Groups[1].Value : incisoNumerico.Groups[1].Value;
                var cuerpo = inciso.Success ? inciso.Groups[2].Value : incisoNumerico.Groups[2].Value;
                html.Append($"<li value=\"{etiqueta}\">{Escapar(cuerpo)}</li>\n");
            }
            else if (linea.Length == 0)
            {
                CerrarParrafo();
            }
            else
            {
                if (parrafoActual.Length > 0)
                {
                    parrafoActual.Append(' ');
                }
                parrafoActual.Append(linea);
            }
        }

        CerrarParrafo();
        if (incisosAbiertos)
        {
            html.Append("</ol>\n");
        }

        return html.ToString().TrimEnd('\n');
    }

    private static string Escapar(string texto) =>
        System.Net.WebUtility.HtmlEncode(texto);
}
