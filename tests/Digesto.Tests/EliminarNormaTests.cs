using Digesto.Api.Controllers;
using Digesto.Application.Archivos;
using Digesto.Domain.Entidades;
using Digesto.Domain.Enums;
using Digesto.Infrastructure;
using Digesto.Infrastructure.Persistencia;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Digesto.Tests;

public class EliminarNormaTests : IClassFixture<MigracionYBusquedaFixture>
{
    private static readonly SemaphoreSlim SemillaLock = new(1, 1);
    private static ServiceProvider? _compartido;
    private static int _proximoNumero = 1000;
    private readonly MigracionYBusquedaFixture _fixture;

    public EliminarNormaTests(MigracionYBusquedaFixture fixture)
    {
        _fixture = fixture;
    }

    private sealed class AlmacenNulo : IFileStorage
    {
        public string Root => Path.GetTempPath();
        public Task<ArchivoGuardado> GuardarAsync(Stream contenido, string nombreOriginal, CancellationToken ct = default) =>
            Task.FromResult(new ArchivoGuardado("nulo", 0));
        public Task<Stream> AbrirAsync(string storageKey, CancellationToken ct = default) =>
            Task.FromResult<Stream>(new MemoryStream());
        public Task EliminarAsync(string storageKey, CancellationToken ct = default) => Task.CompletedTask;
    }

    private async Task<(ServiceProvider services, Guid normaId)> PrepararAsync()
    {
        await SemillaLock.WaitAsync();
        try
        {
            if (_compartido is null)
            {
                var services = new ServiceCollection();
                services.AddLogging();
                services.AddDigestoInfrastructure(_fixture.CadenaConexion, Path.Combine(Path.GetTempPath(), "digesto-elim-" + Guid.NewGuid().ToString("N")[..8]));
                _compartido = services.BuildServiceProvider();

                var db = _compartido.GetRequiredService<DigestoDbContext>();
                await db.Database.MigrateAsync();
            }

            var contexto = _compartido.GetRequiredService<DigestoDbContext>();
            var tipo = await contexto.TiposNorma.FirstOrDefaultAsync(t => t.Codigo == "TST");
            var organo = await contexto.OrganosEmisores.FirstOrDefaultAsync(o => o.Codigo == "TST");
            if (tipo is null)
            {
                tipo = new TipoNorma { Codigo = "TST", Nombre = "Test" };
                organo = new OrganoEmisor { Codigo = "TST", Nombre = "Test" };
                contexto.TiposNorma.Add(tipo);
                contexto.OrganosEmisores.Add(organo!);
                await contexto.SaveChangesAsync();
            }

            var normaId = Guid.NewGuid();
            var archivoId = Guid.NewGuid();
            var numero = Interlocked.Increment(ref _proximoNumero);
            contexto.Normas.Add(new Norma
            {
                Id = normaId,
                TipoNormaId = tipo.Id,
                OrganoEmisorId = organo.Id,
                Numero = numero,
                Anio = 2026,
                CodigoNormalizado = $"TST-TST-2026-{numero:D4}",
                Titulo = "Norma a eliminar",
                FechaSancion = new DateOnly(2026, 1, 15),
                Visibilidad = Visibilidad.Publica,
                EstadoPublicacion = EstadoPublicacion.Borrador,
                TextoOrigen = TextoOrigen.Nativo,
                CreadoEn = DateTime.UtcNow,
                CreadoPor = "test",
            });
            contexto.NormasArchivos.Add(new NormaArchivo
            {
                Id = archivoId,
                NormaId = normaId,
                NombreOriginal = "test.pdf",
                StorageKey = "test.pdf",
                Sha256 = "abc",
            });
            contexto.NormasFragmentos.Add(new NormaFragmento
            {
                NormaId = normaId,
                Orden = 1,
                Tipo = TipoFragmento.Articulo,
                Texto = "Texto",
            });
            contexto.ProcesosIngesta.Add(new ProcesoIngesta
            {
                NormaId = normaId,
                ArchivoId = archivoId,
            });
            await contexto.SaveChangesAsync();
            contexto.ChangeTracker.Clear();

            return (_compartido, normaId);
        }
        finally
        {
            SemillaLock.Release();
        }
    }

    [Fact]
    public async Task Eliminar_ConProcesoDeIngesta_BorraTodoSinViolarFk()
    {
        var (services, normaId) = await PrepararAsync();
        var db = services.GetRequiredService<DigestoDbContext>();
        var controlador = new NormasAdminDetalleController(db, new AlmacenNulo())
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };

        var resultado = await controlador.Eliminar(normaId, CancellationToken.None);

        Assert.IsType<NoContentResult>(resultado);
        Assert.False(await db.Normas.AnyAsync(n => n.Id == normaId));
        Assert.False(await db.NormasArchivos.AnyAsync(a => a.NormaId == normaId));
        Assert.False(await db.NormasFragmentos.AnyAsync(f => f.NormaId == normaId));
        Assert.False(await db.ProcesosIngesta.AnyAsync(p => p.NormaId == normaId));
    }

    [Fact]
    public async Task Eliminar_NormaInexistente_Retorna404()
    {
        var (services, _) = await PrepararAsync();
        var db = services.GetRequiredService<DigestoDbContext>();
        var controlador = new NormasAdminDetalleController(db, new AlmacenNulo())
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };

        var resultado = await controlador.Eliminar(Guid.NewGuid(), CancellationToken.None);

        var noEncontrada = Assert.IsType<ObjectResult>(resultado);
        Assert.Equal(404, noEncontrada.StatusCode);
    }
}
