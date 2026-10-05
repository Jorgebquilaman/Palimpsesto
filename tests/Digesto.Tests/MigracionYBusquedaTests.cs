using Dapper;
using Digesto.Domain.Entidades;
using Digesto.Domain.Enums;
using Digesto.Infrastructure.Persistencia;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace Digesto.Tests;

public class MigracionYBusquedaFixture : IAsyncLifetime
{
    public PostgreSqlContainer Contenedor { get; private set; } = null!;
    public string CadenaConexion = null!;

    public async Task InitializeAsync()
    {
        Contenedor = new PostgreSqlBuilder()
            .WithImage("postgres:16-alpine")
            .Build();
        await Contenedor.StartAsync();
        CadenaConexion = Contenedor.GetConnectionString();
    }

    public async Task DisposeAsync()
    {
        if (Contenedor is not null)
        {
            await Contenedor.DisposeAsync();
        }
    }
}

public class MigracionYBusquedaTests : IClassFixture<MigracionYBusquedaFixture>
{
    private readonly MigracionYBusquedaFixture _fixture;

    public MigracionYBusquedaTests(MigracionYBusquedaFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task Migracion_AplicaExtensionesConfiguracionesEIndices()
    {
        await using var db = CrearDbContext();

        await db.Database.MigrateAsync();

        var con = new Npgsql.NpgsqlConnection(_fixture.CadenaConexion);
        await con.OpenAsync();

        var migraciones = (await con.QueryAsync<string>(
            "SELECT migration_id FROM \"__EFMigrationsHistory\" ORDER BY migration_id")).ToList();
        System.IO.File.WriteAllLines("/tmp/migs.log", migraciones);

        var extensiones = (await con.QueryAsync<string>(
            "SELECT extname FROM pg_extension WHERE extname IN ('unaccent', 'pg_trgm') ORDER BY 1")).ToList();
        Assert.Equal(new[] { "pg_trgm", "unaccent" }, extensiones);

        var funciones = (await con.QueryAsync<string>(
            "SELECT proname FROM pg_proc WHERE proname IN ('f_unaccent', 'f_unir') ORDER BY 1")).ToList();
        Assert.Equal(new[] { "f_unaccent", "f_unir" }, funciones);

        var columnasTsv = (await con.QueryAsync<string>(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'norma_fragmento' AND column_name IN ('tsv_es', 'tsv_lit') ORDER BY 1")).ToList();
        Assert.Equal(new[] { "tsv_es", "tsv_lit" }, columnasTsv);

        var columnasMeta = (await con.QueryAsync<string>(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'norma' AND column_name = 'tsv_meta'")).ToList();
        Assert.Single(columnasMeta);

        var indices = (await con.QueryAsync<string>(
            "SELECT indexname FROM pg_indexes WHERE indexname IN ('ix_fragmento_tsv_es', 'ix_fragmento_tsv_lit', 'ix_norma_tsv_meta', 'ix_norma_titulo_trgm', 'ix_norma_codigo_trgm', 'ix_norma_unicidad') ORDER BY 1")).ToList();
        Assert.Equal(6, indices.Count);
    }

    [Fact]
    public async Task BusquedaFragmento_ConSinosAcentos_Coincide()
    {
        await using var db = CrearDbContext();
        await db.Database.MigrateAsync();

        await SembrarNormaConFragmento(db, "Resolución de becas de extensión");
        await db.SaveChangesAsync();

        var con = new Npgsql.NpgsqlConnection(_fixture.CadenaConexion);
        await con.OpenAsync();

        var conAcentos = await con.ExecuteScalarAsync<bool>(
            "SELECT COUNT(*) > 0 FROM norma_fragmento WHERE tsv_es @@ websearch_to_tsquery('spanish', f_unaccent(@q))",
            new { q = "becas" });
        var sinAcentos = await con.ExecuteScalarAsync<bool>(
            "SELECT COUNT(*) > 0 FROM norma_fragmento WHERE tsv_es @@ websearch_to_tsquery('spanish', f_unaccent(@q))",
            new { q = "becas extension" });
        var fraseExacta = await con.ExecuteScalarAsync<bool>(
            "SELECT COUNT(*) > 0 FROM norma_fragmento WHERE tsv_lit @@ phraseto_tsquery('simple', f_unaccent(@q))",
            new { q = "becas de extension" });

        Assert.True(conAcentos);
        Assert.True(sinAcentos);
        Assert.True(fraseExacta);
    }

    [Fact]
    public async Task UnicidadNorma_RechazaDuplicadosConSufijoNulo()
    {
        await using var db = CrearDbContext();
        await db.Database.MigrateAsync();

        await SembrarNormaConFragmento(db, "Primera", 2);

        var tipo = await db.TiposNorma.FirstAsync();
        var organo = await db.OrganosEmisores.FirstAsync();
        var duplicada = new Norma
        {
            Id = Guid.NewGuid(),
            TipoNormaId = tipo.Id,
            OrganoEmisorId = organo.Id,
            Numero = 2,
            Anio = 2024,
            CodigoNormalizado = $"{tipo.Codigo}-{organo.Codigo}-2024-0002-dup",
            Titulo = "Duplicada",
            FechaSancion = new DateOnly(2024, 1, 15),
            Visibilidad = Visibilidad.Publica,
            EstadoPublicacion = EstadoPublicacion.Publicada,
            TextoOrigen = TextoOrigen.Nativo,
            CreadoEn = DateTime.UtcNow,
            CreadoPor = "test",
        };
        db.Normas.Add(duplicada);

        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }

    private DigestoDbContext CrearDbContext()
    {
        var options = new DbContextOptionsBuilder<DigestoDbContext>()
            .UseNpgsql(_fixture.CadenaConexion)
            .UseSnakeCaseNamingConvention()
            .Options;
        return new DigestoDbContext(options);
    }

    private static async Task<(TipoNorma, OrganoEmisor)> AsegurarCatalogos(DigestoDbContext db)
    {
        var tipo = await db.TiposNorma.FirstOrDefaultAsync();
        if (tipo is null)
        {
            tipo = new TipoNorma { Codigo = "RES", Nombre = "Resolución", Alcance = "general" };
            db.TiposNorma.Add(tipo);
            db.OrganosEmisores.Add(new OrganoEmisor { Codigo = "CS", Nombre = "Consejo Superior" });
            await db.SaveChangesAsync();
            tipo = await db.TiposNorma.FirstAsync();
        }
        var organo = await db.OrganosEmisores.FirstAsync();
        return (tipo, organo);
    }

    private static async Task SembrarNormaConFragmento(DigestoDbContext db, string titulo, int numero = 1)
    {
        var (tipo, organo) = await AsegurarCatalogos(db);

        var norma = new Norma
        {
            Id = Guid.NewGuid(),
            TipoNormaId = tipo.Id,
            OrganoEmisorId = organo.Id,
            Numero = numero,
            Anio = 2024,
            CodigoNormalizado = $"{tipo.Codigo}-{organo.Codigo}-2024-{numero:D4}",
            Titulo = titulo,
            FechaSancion = new DateOnly(2024, 1, 15),
            Visibilidad = Visibilidad.Publica,
            EstadoPublicacion = EstadoPublicacion.Publicada,
            TextoOrigen = TextoOrigen.Nativo,
            CreadoEn = DateTime.UtcNow,
            CreadoPor = "test",
        };
        db.Normas.Add(norma);
        db.NormasFragmentos.Add(new NormaFragmento
        {
            NormaId = norma.Id,
            Orden = 1,
            Tipo = TipoFragmento.Articulo,
            Etiqueta = "Artículo 1º",
            Texto = "Otorgar becas de extensión universitaria a los estudiantes que presenten proyectos comunitarios.",
            PaginaDesde = 1,
            PaginaHasta = 1,
        });
        await db.SaveChangesAsync();
    }
}
