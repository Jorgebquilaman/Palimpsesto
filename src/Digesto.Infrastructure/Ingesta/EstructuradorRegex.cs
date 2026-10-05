using System.Text.RegularExpressions;
using Digesto.Application.Ingesta;
using Digesto.Domain.Enums;

namespace Digesto.Infrastructure.Ingesta;

public partial class EstructuradorRegex : IEstructurador
{
    [GeneratedRegex(@"(?im)^\s*(VISTO|VISTOS)[\s:]", RegexOptions.CultureInvariant)]
    private static partial Regex RegexVisto();

    [GeneratedRegex(@"(?im)^\s*(CONSIDERANDO|CONSIDERANDOS)[\s:]", RegexOptions.CultureInvariant)]
    private static partial Regex RegexConsiderando();

    [GeneratedRegex(@"(?im)^\s*(RESUELVE|ORDENA|DECLARA|DISPONE|RESUELVE Y DECLARA)\s*[:.]?\s*$", RegexOptions.CultureInvariant)]
    private static partial Regex RegexDispositiva();

    [GeneratedRegex(@"(?im)^\s*(ART[ÍI]CULO)\s*N?[°º.]?\s*(\d+)\s*[°º]?\s*[.\-—:·]?\s*(.*)$", RegexOptions.CultureInvariant)]
    private static partial Regex RegexArticulo();

    [GeneratedRegex(@"(?im)^\s*(ANEXO)\s+([IVXLC]+|\d+)\s*[.:\-]?\s*(.*)$", RegexOptions.CultureInvariant)]
    private static partial Regex RegexAnexo();

    [GeneratedRegex(@"^\s*(?:ART[ÍI]CULO)\s*N?[°º.]?\s*(\d+)", RegexOptions.IgnoreCase)]
    private static partial Regex RegexInicioArticulo();

    public List<FragmentoSugerido> Estructurar(string texto, int paginas)
    {
        if (string.IsNullOrWhiteSpace(texto))
        {
            return [];
        }

        var candidatos = new List<(int Pos, TipoFragmento Tipo, string Etiqueta)>();

        foreach (var m in RegexVisto().Matches(texto).Cast<Match>())
        {
            candidatos.Add((m.Index, TipoFragmento.Visto, "VISTO"));
        }
        foreach (var m in RegexConsiderando().Matches(texto).Cast<Match>())
        {
            candidatos.Add((m.Index, TipoFragmento.Considerando, "CONSIDERANDO"));
        }
        foreach (var m in RegexDispositiva().Matches(texto).Cast<Match>())
        {
            candidatos.Add((m.Index, TipoFragmento.ParteDispositiva, m.Groups[1].Value));
        }
        foreach (var m in RegexArticulo().Matches(texto).Cast<Match>())
        {
            candidatos.Add((m.Index, TipoFragmento.Articulo, $"Artículo {m.Groups[2].Value}"));
        }
        foreach (var m in RegexAnexo().Matches(texto).Cast<Match>())
        {
            candidatos.Add((m.Index, TipoFragmento.Anexo, $"ANEXO {m.Groups[2].Value}"));
        }

        if (candidatos.Count == 0)
        {
            return [
                new FragmentoSugerido(1, TipoFragmento.Pagina, null, texto, null, paginas),
            ];
        }

        candidatos = candidatos
            .OrderBy(c => c.Pos)
            .GroupBy(c => c.Pos)
            .Select(g => g.First())
            .ToList();

        var fragmentos = new List<FragmentoSugerido>();
        for (var i = 0; i < candidatos.Count; i++)
        {
            var inicio = candidatos[i].Pos;
            var fin = i + 1 < candidatos.Count ? candidatos[i + 1].Pos : texto.Length;
            var contenido = texto[inicio..fin].Trim();

            if (candidatos[i].Tipo == TipoFragmento.Articulo && contenido.Length > RegexInicioArticulo().Match(contenido).Length)
            {
                contenido = contenido[Math.Max(0, RegexInicioArticulo().Match(contenido).Length)..].TrimStart('-', ' ', '.', ':', 'º', '°');
            }

            if (!string.IsNullOrWhiteSpace(contenido))
            {
                fragmentos.Add(new FragmentoSugerido(
                    fragmentos.Count + 1,
                    candidatos[i].Tipo,
                    candidatos[i].Etiqueta,
                    contenido,
                    null,
                    null));
            }
        }

        return fragmentos;
    }
}
