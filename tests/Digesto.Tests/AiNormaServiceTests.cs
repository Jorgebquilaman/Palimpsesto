using Digesto.Domain.Enums;
using Digesto.Infrastructure.Ai;

namespace Digesto.Tests;

public class AiNormaServiceTests
{
    [Fact]
    public void ParsearRespuesta_JsonLimpio()
    {
        const string crudo = """
            {
              "tipo_norma": "RES",
              "numero": 42,
              "anio": 2025,
              "sufijo": "bis",
              "titulo": "Plan anual de investigación",
              "resumen": "Aprueba el plan anual de investigación académica de la institución para el ciclo 2025.",
              "palabras_clave": ["investigación", "plan anual", "académica"],
              "expediente": "42424-2025",
              "fecha_sancion": "2025-03-01",
              "organo": "REC",
              "vigencia": "vigente",
              "citas": [
                { "tipo": "RES", "numero": 100, "anio": 2024, "tipo_relacion": "modifica" },
                { "tipo": "XX", "numero": 1, "anio": 2020, "tipo_relacion": "deroga" }
              ]
            }
            """;

        var datos = AiNormaService.ParsearRespuesta(crudo);

        Assert.Equal("RES", datos.TipoNormaCodigo);
        Assert.Equal(42, datos.Numero);
        Assert.Equal((short)2025, datos.Anio);
        Assert.Equal("bis", datos.Sufijo);
        Assert.Equal(3, datos.PalabrasClave!.Length);
        Assert.Equal(new DateOnly(2025, 3, 1), datos.FechaSancion);
        Assert.Equal(2, datos.Citas.Count);
        Assert.Equal("deroga", datos.Citas[1].TipoRelacion);
    }

    [Fact]
    public void ParsearRespuesta_ConCercasDeMarkdown()
    {
        const string crudo = "```json\n{\"numero\": 7, \"anio\": 2024, \"titulo\": \"Becas\", \"citas\": []}\n```";
        var datos = AiNormaService.ParsearRespuesta(crudo);

        Assert.Equal(7, datos.Numero);
        Assert.Equal("Becas", datos.Titulo);
        Assert.Empty(datos.Citas);
    }

    [Fact]
    public void ParsearRespuesta_TextoAlrededor()
    {
        const string crudo = "Claro, acá va:\n{\"numero\": 3, \"anio\": 2023, \"citas\": []}\nSaludos.";
        var datos = AiNormaService.ParsearRespuesta(crudo);

        Assert.Equal(3, datos.Numero);
    }

    [Fact]
    public void ParsearRespuesta_DatosAusentes_SonNulos()
    {
        const string crudo = "{\"citas\": []}";
        var datos = AiNormaService.ParsearRespuesta(crudo);

        Assert.Null(datos.TipoNormaCodigo);
        Assert.Null(datos.Numero);
    }
}
