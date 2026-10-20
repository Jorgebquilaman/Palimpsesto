using Digesto.Application.Busquedas;
using Digesto.Domain.Entidades;
using Digesto.Domain.Enums;
using Digesto.Infrastructure;
using Digesto.Infrastructure.Persistencia;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Digesto.Tests;

public class PalabrasClaveTests : IClassFixture<MigracionYBusquedaFixture>
{
    private static readonly SemaphoreSlim SemillaLock = new(1, 1);
    private static ServiceProvider? _compartido;
    private readonly MigracionYBusquedaFixture _fixture;

    public PalabrasClaveTests(MigracionYBusquedaFixture fixture)
    {
        _fixture = fixture;
    }

    private async Task<ServiceProvider> PrepararAsync()
    {
        if (_compartido is not null)
        {
            return _compartido;
        }

        await SemillaLock.WaitAsync();
        try
        {
            if (_compartido is not null)
            {
                return _compartido;
            }

            var services = new ServiceCollection();
            services.AddLogging();
            services.AddDigestoInfrastructure(_fixture.CadenaConexion, Path.Combine(Path.GetTempPath(), "digesto-pal-" + Guid.NewGuid().ToString("N")[..8]));

            _compartido = services.BuildServiceProvider();

            var db = _compartido.GetRequiredService<DigestoDbContext>();
            await db.Database.MigrateAsync();

            var tipoRes = await db.TiposNorma.FirstOrDefaultAsync(t => t.Codigo == "RES");
            var tipoOrd = await db.TiposNorma.FirstOrDefaultAsync(t => t.Codigo == "ORD");
            var organo = await db.OrganosEmisores.FirstOrDefaultAsync(o => o.Codigo == "CS");

            if (tipoRes is null)
            {
                tipoRes = new TipoNorma { Codigo = "RES", Nombre = "Resolución" };
                tipoOrd = new TipoNorma { Codigo = "ORD", Nombre = "Ordenanza" };
                organo = new OrganoEmisor { Codigo = "CS", Nombre = "Consejo Superior" };
                db.TiposNorma.AddRange(tipoRes, tipoOrd);
                db.OrganosEmisores.Add(organo);
                await db.SaveChangesAsync();
            }

            await CrearNormaAsync(db, tipoRes, organo!, 123, 2024, "Resolución de becas", ["becas", "extensión"]);
            await CrearNormaAsync(db, tipoRes, organo!, 124, 2024, "Resolución de concursos", ["concursos", "docencia"]);
            await CrearNormaAsync(db, tipoOrd!, organo!, 5, 2023, "Ordenanza académica", ["becas", "docencia"]);
            await CrearNormaAsync(db, tipoRes, organo!, 100, 2025, "Resolución reservada", ["presupuesto"], Visibilidad.Reservada);
            await CrearNormaAsync(db, tipoRes, organo!, 101, 2025, "Resolución interna", ["presupuesto", "comisión"], Visibilidad.Interna);
            await CrearNormaAsync(db, tipoRes, organo!, 102, 2025, "Resolución sin palabras", null);

            return _compartido;
        }
        finally
        {
            SemillaLock.Release();
        }
    }

    private static async Task CrearNormaAsync(
        DigestoDbContext db,
        TipoNorma tipo,
        OrganoEmisor organo,
        int numero,
        short anio,
        string titulo,
        string[]? palabras,
        Visibilidad visibilidad = Visibilidad.Publica)
    {
        db.Normas.Add(new Norma
        {
            Id = Guid.NewGuid(),
            TipoNormaId = tipo.Id,
            OrganoEmisorId = organo.Id,
            Numero = numero,
            Anio = anio,
            CodigoNormalizado = $"{tipo.Codigo}-{organo.Codigo}-{anio}-{numero:D4}",
            Titulo = titulo,
            FechaSancion = new DateOnly(anio, 1, 15),
            Visibilidad = visibilidad,
            EstadoPublicacion = EstadoPublicacion.Publicada,
            TextoOrigen = TextoOrigen.Nativo,
            PalabrasClave = palabras,
            CreadoEn = DateTime.UtcNow,
            CreadoPor = "test",
        });
        await db.SaveChangesAsync();
    }

    private static IPalabrasClaveNormas Agregador(ServiceProvider services) =>
        services.GetRequiredService<IPalabrasClaveNormas>();

    private static IBuscadorNormas Buscador(ServiceProvider services) =>
        services.GetRequiredService<IBuscadorNormas>();

    private static FiltrosBusqueda Filtros(string? palabra = null) =>
        new(null, ModoBusqueda.Todas, null, null, null, null, null, null, null, "relevancia", 1, 20, palabra);

    [Fact]
    public async Task Buscar_PorPalabra_IgnoraMayusculasYAcentos()
    {
        var services = await PrepararAsync();

        var exacta = await Buscador(services).BuscarAsync(Filtros("becas"));
        var mayuscula = await Buscador(services).BuscarAsync(Filtros("BECAS"));
        var sinAcento = await Buscador(services).BuscarAsync(Filtros("extension"));

        Assert.Equal(2, exacta.Total);
        Assert.Equal(2, mayuscula.Total);
        Assert.Equal(1, sinAcento.Total);
    }

    [Fact]
    public async Task Agregar_CuentaPorPalabraOrdenada()
    {
        var services = await PrepararAsync();
        var resultado = await Agregador(services).AgregarAsync(null, null, null, null, null, null, null);

        Assert.False(resultado.HayMas);
        Assert.Equal(4, resultado.Palabras.Count);
        Assert.Equal("becas", resultado.Palabras[0].Palabra);
        Assert.Equal(2, resultado.Palabras[0].Cantidad);
        Assert.Equal("docencia", resultado.Palabras[1].Palabra);
        Assert.Equal(2, resultado.Palabras[1].Cantidad);
    }

    [Fact]
    public async Task Agregar_RespetaFiltrosYPaginacion()
    {
        var services = await PrepararAsync();
        var db = services.GetRequiredService<DigestoDbContext>();
        var tipoOrd = await db.TiposNorma.SingleAsync(t => t.Codigo == "ORD");

        var porTipo = await Agregador(services).AgregarAsync(tipoOrd.Id, null, null, null, null, null, null);
        Assert.Equal(2, porTipo.Palabras.Count);
        Assert.All(porTipo.Palabras, p => Assert.Equal(1, p.Cantidad));

        var porAnio = await Agregador(services).AgregarAsync(null, null, null, null, 2024, null, null);
        Assert.Equal(4, porAnio.Palabras.Count);
        Assert.DoesNotContain(porAnio.Palabras, p => p.Palabra == "becas" && p.Cantidad == 2);

        var pagina1 = await Agregador(services).AgregarAsync(null, null, null, null, null, null, null, limite: 2, offset: 0);
        Assert.True(pagina1.HayMas);
        Assert.Equal(2, pagina1.Palabras.Count);

        var pagina2 = await Agregador(services).AgregarAsync(null, null, null, null, null, null, null, limite: 2, offset: 2);
        Assert.False(pagina2.HayMas);
        Assert.Equal(2, pagina2.Palabras.Count);
        Assert.DoesNotContain(pagina2.Palabras, p => pagina1.Palabras.Any(q => q.Palabra == p.Palabra));
    }

    [Fact]
    public async Task Agregar_NoFugaReservadasNiInternas()
    {
        var services = await PrepararAsync();
        var resultado = await Agregador(services).AgregarAsync(null, null, null, null, null, null, null);

        Assert.DoesNotContain(resultado.Palabras, p => p.Palabra == "presupuesto");
        Assert.DoesNotContain(resultado.Palabras, p => p.Palabra == "comisión");
    }

    [Fact]
    public async Task Buscar_PorPalabraExacta()
    {
        var services = await PrepararAsync();
        var buscador = Buscador(services);

        var porBecas = await buscador.BuscarAsync(
            new FiltrosBusqueda(null, ModoBusqueda.Todas, null, null, null, null, null, null, null, "relevancia", 1, 20, "becas"));
        Assert.Equal(2, porBecas.Total);
        Assert.Contains(porBecas.Items, i => i.Codigo == "RES-CS-2024-0123");
        Assert.Contains(porBecas.Items, i => i.Codigo == "ORD-CS-2023-0005");
        Assert.Equal(2, porBecas.Facetas.Tipos.Sum(t => t.Cantidad));

        var inexistente = await buscador.BuscarAsync(
            new FiltrosBusqueda(null, ModoBusqueda.Todas, null, null, null, null, null, null, null, "relevancia", 1, 20, "presupuesto"));
        Assert.Equal(0, inexistente.Total);
    }
}
