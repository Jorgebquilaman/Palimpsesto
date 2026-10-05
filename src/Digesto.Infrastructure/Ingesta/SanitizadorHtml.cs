using AngleSharp;
using AngleSharp.Dom;
using AngleSharp.Html.Parser;
using Digesto.Application.Ingesta;

namespace Digesto.Infrastructure.Ingesta;

public class SanitizadorHtml : ISanitizadorHtml
{
    private static readonly HashSet<string> EtiquetasPermitidas =
    [
        "h1", "h2", "h3", "h4", "p", "ul", "ol", "li", "strong", "em", "b", "i", "br", "span", "a", "table", "thead", "tbody", "tr", "th", "td",
    ];

    private static readonly HashSet<string> AtributosPermitidos =
    [
        "id", "data-page", "href",
    ];

    private static readonly Lazy<IHtmlParser> Parser = new(() =>
        BrowsingContext.New(Configuration.Default).GetService<IHtmlParser>()!);

    public string Sanitizar(string html)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return "";
        }

        var documento = Parser.Value.ParseDocument($"<div>{html}</div>");
        var raiz = documento.Body!.FirstElementChild!;
        Limpiar(raiz);

        using var writer = new System.IO.StringWriter();
        raiz.ToHtml(writer);
        return writer.ToString();
    }

    private static void Limpiar(IElement elemento)
    {
        foreach (var hijo in elemento.Children.ToArray())
        {
            Limpiar(hijo);
        }

        if (!EtiquetasPermitidas.Contains(elemento.LocalName))
        {
            if (!string.IsNullOrWhiteSpace(elemento.TextContent) && elemento.ParentElement is not null)
            {
                var texto = documento(elemento);
                elemento.ParentElement.ReplaceChild(texto, elemento);
            }
            else
            {
                elemento.Remove();
            }
            return;
        }

        foreach (var atributo in elemento.Attributes.ToArray())
        {
            var nombre = atributo.Name.ToLowerInvariant();
            if (!AtributosPermitidos.Contains(nombre)
                || (nombre == "href" && !atributo.Value.StartsWith('#')))
            {
                elemento.RemoveAttribute(atributo.Name);
            }
        }
    }

    private static INode documento(IElement elemento) =>
        elemento.Owner!.CreateTextNode(elemento.TextContent);
}
