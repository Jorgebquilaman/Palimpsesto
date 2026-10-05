using Dapper;
using Digesto.Application.Ingesta;
using Digesto.Domain.Enums;
using Digesto.Infrastructure.Ingesta;
using Digesto.Infrastructure.Persistencia;
using Microsoft.EntityFrameworkCore;
using Digesto.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Digesto.Tests;

public class IngestaEndToEndTests : IClassFixture<MigracionYBusquedaFixture>
{
    private readonly MigracionYBusquedaFixture _fixture;

    public IngestaEndToEndTests(MigracionYBusquedaFixture fixture)
    {
        _fixture = fixture;
    }

    private ServiceProvider CrearServices(string raizArchivos)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDigestoInfrastructure(_fixture.CadenaConexion, raizArchivos);
        services.Configure<IngestaOpciones>(o =>
        {
            o.UmbralCaracteresPagina = 100;
            o.TamanioMaximoMb = 50;
        });
        return services.BuildServiceProvider();
    }

    [Fact]
    public async Task SubirYProcesar_PdfNativo_CreaNormaFragmentosYEstados()
    {
        var raiz = Path.Combine(Path.GetTempPath(), "digesto-test-" + Guid.NewGuid().ToString("N")[..8]);
        await using var services = CrearServices(raiz);

        var db = services.GetRequiredService<DigestoDbContext>();
        await db.Database.MigrateAsync();

        if (!await db.TiposNorma.AnyAsync())
        {
            db.TiposNorma.Add(new Digesto.Domain.Entidades.TipoNorma { Codigo = "RES", Nombre = "Resolución" });
            db.OrganosEmisores.Add(new Digesto.Domain.Entidades.OrganoEmisor { Codigo = "REC", Nombre = "Rectorado" });
            await db.SaveChangesAsync();
        }

        var lineas = new[]
        {
            "RESOLUCIÓN N° 77/2024 - REC",
            "Buenos Aires, 20 de febrero de 2024",
            "VISTO: El expediente 99999-2024 por el cual se solicita crear becas.",
            "CONSIDERANDO:",
            "Que corresponde otorgar becas de extensión universitaria;",
            "RESUELVE:",
            "ARTÍCULO 1º: Otorgar becas de extensión a los estudiantes que presenten proyectos comunitarios.",
            "ARTÍCULO 2º: Comuníquese y archívese.",
        };

        var pdf = PdfFabrica.Generar(lineas);

        var ingesta = services.GetRequiredService<IIngestaService>();
        var creada = await ingesta.SubirPdfAsync(
            new MemoryStream(pdf), "resolucion-77-2024.pdf", "test", default);

        Assert.False(creada.Duplicado);

        var pipeline = services.GetRequiredService<PipelineIngesta>();
        var proceso = await db.ProcesosIngesta.FirstAsync(p => p.NormaId == creada.NormaId);
        var ok = await pipeline.ProcesarAsync(proceso.Id);

        Assert.True(ok);

        await db.Entry(proceso).ReloadAsync();
        Assert.Equal(EstadoProceso.Ok, proceso.Estado);

        var norma = await db.Normas.FirstAsync(n => n.Id == creada.NormaId);
        Assert.Equal(EstadoPublicacion.EnRevision, norma.EstadoPublicacion);
        Assert.Equal(77, norma.Numero);
        Assert.Equal((short)2024, norma.Anio);
        Assert.Equal(new DateOnly(2024, 2, 20), norma.FechaSancion);

        var fragmentos = await db.NormasFragmentos
            .Where(f => f.NormaId == norma.Id)
            .OrderBy(f => f.Orden)
            .ToListAsync();

        Assert.Equal(5, fragmentos.Count);
        Assert.Equal(TipoFragmento.Visto, fragmentos[0].Tipo);
        Assert.Equal(TipoFragmento.Considerando, fragmentos[1].Tipo);
        Assert.Equal(TipoFragmento.ParteDispositiva, fragmentos[2].Tipo);
        Assert.Equal(TipoFragmento.Articulo, fragmentos[3].Tipo);
        Assert.Equal("Artículo 1", fragmentos[3].Etiqueta);
        Assert.Equal(TipoFragmento.Articulo, fragmentos[4].Tipo);
        Assert.Equal("Artículo 2", fragmentos[4].Etiqueta);
        Assert.Contains("""id="art-1""", fragmentos[3].Html);
        Assert.Contains("becas", fragmentos[3].Texto);

        var con = new Npgsql.NpgsqlConnection(_fixture.CadenaConexion);
        await con.OpenAsync();
        var matchea = await con.ExecuteScalarAsync<bool>(
            "SELECT COUNT(*) > 0 FROM norma_fragmento WHERE tsv_es @@ websearch_to_tsquery('es_unaccent', @q)",
            new { q = "becas" });
        Assert.True(matchea);

        Directory.Delete(raiz, recursive: true);
    }

    [Fact]
    public async Task Subir_NoPdf_Rechazado()
    {
        var raiz = Path.Combine(Path.GetTempPath(), "digesto-test-" + Guid.NewGuid().ToString("N")[..8]);
        await using var services = CrearServices(raiz);

        var db = services.GetRequiredService<DigestoDbContext>();
        await db.Database.MigrateAsync();

        if (!await db.TiposNorma.AnyAsync())
        {
            db.TiposNorma.Add(new Digesto.Domain.Entidades.TipoNorma { Codigo = "RES", Nombre = "Resolución" });
            db.OrganosEmisores.Add(new Digesto.Domain.Entidades.OrganoEmisor { Codigo = "REC", Nombre = "Rectorado" });
            await db.SaveChangesAsync();
        }

        var ingesta = services.GetRequiredService<IIngestaService>();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => ingesta.SubirPdfAsync(new MemoryStream([0x00, 0x01, 0x02, 0x03, 0x04]), "falso.pdf", "test"));

        Directory.Delete(raiz, recursive: true);
    }
}
