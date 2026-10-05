using Digesto.Application.Ingesta;
using Digesto.Domain.Enums;
using Digesto.Infrastructure.Ingesta;

namespace Digesto.Tests;

public class EstructuradorTests
{
    private readonly EstructuradorRegex _estructurador = new();

    private const string ResolucionCompleta = """
        RESOLUCIÓN N° 123/2024

        VISTO: El Expediente 12345-2024, por el cual se solicita becas de extensión.

        CONSIDERANDO:
        Que el Consejo Superior aprobó el plan de becas;
        Que resulta necesario reglamentar la convocatoria;

        RESUELVE:

        ARTÍCULO 1º: Otorgar las becas de extensión a los estudiantes que presenten proyectos comunitarios en la Secretaría de Extensión.

        ARTÍCULO 2º: La presente resolución tendrá vigencia desde el 15 de marzo de 2024.

        ARTÍCULO 3º: Comuníquese, publíquese y archívese.
        """;

    [Fact]
    public void Estructurar_ResolucionCompleta_DetectaSeccionesYArticulos()
    {
        var fragmentos = _estructurador.Estructurar(ResolucionCompleta, 2);

        Assert.Equal(TipoFragmento.Visto, fragmentos[0].Tipo);
        Assert.Equal(TipoFragmento.Considerando, fragmentos[1].Tipo);
        Assert.Equal(TipoFragmento.ParteDispositiva, fragmentos[2].Tipo);

        var articulos = fragmentos.Where(f => f.Tipo == TipoFragmento.Articulo).ToList();
        Assert.Equal(3, articulos.Count);
        Assert.Equal("Artículo 1", articulos[0].Etiqueta);
        Assert.Equal("Artículo 3", articulos[2].Etiqueta);
        Assert.Contains("Otorgar las becas", articulos[0].Texto);
    }

    [Fact]
    public void Estructurar_TextoSinEstructura_DevuelveUnFragmentoPorDocumento()
    {
        const string texto = "Contenido sin estructura reconocible\nsegunda línea";
        var fragmentos = _estructurador.Estructurar(texto, 1);

        Assert.Single(fragmentos);
        Assert.Equal(TipoFragmento.Pagina, fragmentos[0].Tipo);
    }

    [Fact]
    public void Estructurar_AnexoDetectado()
    {
        const string texto = "ANEXO I: Formulario de inscripción\ncon campos obligatorios.";
        var fragmentos = _estructurador.Estructurar(texto, 1);

        Assert.Single(fragmentos);
        Assert.Equal(TipoFragmento.Anexo, fragmentos[0].Tipo);
        Assert.Equal("ANEXO I", fragmentos[0].Etiqueta);
    }
}

public class NormalizadorTextoTests
{
    [Fact]
    public void Normalizar_UnirPalabrasCortadasPorGuion()
    {
        const string texto = "La universi-\ndad patagónica emite la reso-\nlución.";
        var resultado = NormalizadorTexto.Normalizar(texto);

        Assert.DoesNotContain("-\n", resultado);
        Assert.Contains("universidad", resultado);
        Assert.Contains("resolución", resultado);
    }

    [Fact]
    public void Normalizar_Unicode()
    {
        const string texto = "cafe\u0301 \"animacio\u0301n\"";
        var resultado = NormalizadorTexto.Normalizar(texto);

        Assert.Contains("café", resultado);
    }
}

public class GeneradorHtmlTests
{
    [Fact]
    public void GenerarHtml_ArticuloConAncla()
    {
        var fragmentos = new List<FragmentoSugerido>
        {
            new(1, TipoFragmento.Articulo, "Artículo 1", "ARTÍCULO 1º: Otorgar becas.\na) primer punto\nb) segundo punto", null, null),
        };

        var resultado = GeneradorHtmlFragmentos.GenerarHtml(fragmentos, "RES-CS-2024-0001");

        Assert.Contains("""id="art-1""", resultado[0].Html);
        Assert.Contains("<h2", resultado[0].Html);
        Assert.Contains("Otorgar becas", resultado[0].Html);
        Assert.Contains("<li", resultado[0].Html);
    }
}

public class SanitizadorHtmlTests
{
    private readonly SanitizadorHtml _sanitizador = new();

    [Fact]
    public void Sanitizar_EliminaScriptsYEventos()
    {
        const string html = """<h2 id="art-1">Título</h2><script>alert('x')</script><p onclick="evil()">texto</p>""";
        var resultado = _sanitizador.Sanitizar(html);

        Assert.DoesNotContain("<script", resultado);
        Assert.DoesNotContain("onclick", resultado);
        Assert.Contains("""<h2 id="art-1">Título</h2>""", resultado);
        Assert.Contains("<p>texto</p>", resultado);
    }

    [Fact]
    public void Sanitizar_EliminaHrefsExternos()
    {
        const string html = """<a href="https://malicioso.com">link</a><a href="#art-2">ancla</a>""";
        var resultado = _sanitizador.Sanitizar(html);

        Assert.DoesNotContain("https://malicioso.com", resultado);
        Assert.Contains("#art-2", resultado);
    }
}

public class ExtractorMetadatosTests
{
    private readonly ExtractorMetadatosHeuristico _extractor = new();

    [Fact]
    public void Extraer_ResolucionTypica()
    {
        const string texto = """
            RESOLUCIÓN N° 123/2024
            RES-REC-2024-0123

            VISTO el Expediente 45678-2024, y

            CONSIDERANDO que corresponde dictar normas, en Buenos Aires a los 15 de marzo de 2024, se resuelve.
            """;

        var metadatos = _extractor.Extraer(texto, "resolucion-123-2024.pdf");

        Assert.Equal("RES", metadatos.TipoNormaCodigo);
        Assert.Equal(123, metadatos.Numero);
        Assert.Equal((short)2024, metadatos.Anio);
        Assert.Equal("45678-2024", metadatos.Expediente);
        Assert.Equal(new DateOnly(2024, 3, 15), metadatos.FechaSancion);
    }
}
