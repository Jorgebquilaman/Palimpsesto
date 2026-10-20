using System.Net;
using System.Text.Json;
using Digesto.Application.Archivos;
using Digesto.Api.Controllers;
using Digesto.Domain.Entidades;
using Digesto.Domain.Enums;
using Digesto.Infrastructure;
using Digesto.Infrastructure.Persistencia;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Digesto.Tests;

public class CodigoNormaTests : IClassFixture<MigracionYBusquedaFixture>
{
    private static readonly SemaphoreSlim SemillaLock = new(1, 1);
    private static ServiceProvider? _compartido;
    private readonly MigracionYBusquedaFixture _fixture;

    public CodigoNormaTests(MigracionYBusquedaFixture fixture)
    {
        _fixture = fixture;
    }

    private async Task<(DigestoDbContext db, Guid normaSinNumero)> PrepararAsync()
    {
        await SemillaLock.WaitAsync();
        try
        {
            if (_compartido is null)
            {
                var services = new ServiceCollection();
                services.AddLogging();
                services.AddDigestoInfrastructure(_fixture.CadenaConexion, Path.Combine(Path.GetTempPath(), "digesto-cod-" + Guid.NewGuid().ToString("N")[..8]));
                _compartido = services.BuildServiceProvider();
                var dbInicial = _compartido.GetRequiredService<DigestoDbContext>();
                await dbInicial.Database.MigrateAsync();
                await SembrarCatalogosYNormas(dbInicial);
            }
            var contexto = _compartido.GetRequiredService<DigestoDbContext>();
            var norma = await contexto.Normas.FirstAsync(n => n.CodigoNormalizado == "TB1-OB1-2026-0007");
            contexto.ChangeTracker.Clear();
            return (contexto, norma.Id);
        }
        finally
        {
            SemillaLock.Release();
        }
    }

    private static async Task SembrarCatalogosYNormas(DigestoDbContext db)
    {
        var tipo1 = new TipoNorma { Codigo = "TB1", Nombre = "Tipo base", Alcance = "provincial", Activo = true };
        var tipo2 = new TipoNorma { Codigo = "TB2", Nombre = "Tipo destino", Alcance = "provincial", Activo = true };
        var organo1 = new OrganoEmisor { Codigo = "OB1", Nombre = "Órgano base", Activo = true };
        var organo2 = new OrganoEmisor { Codigo = "OB2", Nombre = "Órgano destino", Activo = true };
        db.TiposNorma.AddRange(tipo1, tipo2);
        db.OrganosEmisores.AddRange(organo1, organo2);
        await db.SaveChangesAsync();

        db.Normas.Add(new Norma
        {
            Id = Guid.NewGuid(),
            TipoNormaId = tipo1.Id,
            OrganoEmisorId = organo1.Id,
            Numero = 0,
            Anio = 2026,
            Sufijo = null,
            CodigoNormalizado = "TB1-OB1-2026-0007",
            Titulo = "Borrador sin número",
            FechaSancion = new DateOnly(2026, 1, 15),
            Vigencia = Vigencia.Vigente,
            Visibilidad = Visibilidad.Publica,
            EstadoPublicacion = EstadoPublicacion.Borrador,
            TextoOrigen = TextoOrigen.Nativo,
            CreadoEn = DateTime.UtcNow,
            CreadoPor = "test",
        });
        db.Normas.Add(new Norma
        {
            Id = Guid.NewGuid(),
            TipoNormaId = tipo2.Id,
            OrganoEmisorId = organo2.Id,
            Numero = 9,
            Anio = 2026,
            Sufijo = null,
            CodigoNormalizado = "TB2-OB2-2026-0009",
            Titulo = "Norma con número en el espacio destino",
            FechaSancion = new DateOnly(2026, 2, 1),
            Vigencia = Vigencia.Vigente,
            Visibilidad = Visibilidad.Publica,
            EstadoPublicacion = EstadoPublicacion.Borrador,
            TextoOrigen = TextoOrigen.Nativo,
            CreadoEn = DateTime.UtcNow,
            CreadoPor = "test",
        });
        db.Normas.Add(new Norma
        {
            Id = Guid.NewGuid(),
            TipoNormaId = tipo1.Id,
            OrganoEmisorId = organo1.Id,
            Numero = 3,
            Anio = 2026,
            Sufijo = null,
            CodigoNormalizado = "TB1-OB1-2026-0003",
            Titulo = "Norma que ocupa la numeración 3",
            FechaSancion = new DateOnly(2026, 2, 1),
            Vigencia = Vigencia.Vigente,
            Visibilidad = Visibilidad.Publica,
            EstadoPublicacion = EstadoPublicacion.Borrador,
            TextoOrigen = TextoOrigen.Nativo,
            CreadoEn = DateTime.UtcNow,
            CreadoPor = "test",
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
    }

    private static NormasAdminDetalleController CrearControlador(DigestoDbContext db)
    {
        return new NormasAdminDetalleController(db, new AlmacenNulo())
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };
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

    [Fact]
    public async Task Actualizar_CambiaTipoYOrganoSinNumero_RegeneraCodigoEnNuevoEspacio()
    {
        var (db, normaId) = await PrepararAsync();
        var tipoDestino = await db.TiposNorma.FirstAsync(t => t.Codigo == "TB2");
        var organoDestino = await db.OrganosEmisores.FirstAsync(o => o.Codigo == "OB2");
        var controlador = CrearControlador(db);

        var resultado = await controlador.Actualizar(normaId, new ActualizarNormaRequest(
            null, null, null, null, tipoDestino.Id, organoDestino.Id,
            null, null, null, null, null, null, null), CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(resultado);
        var dato = JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(ok.Value));
        var codigoResp = dato.GetProperty("CodigoNormalizado").GetString() ?? "";
        Assert.True(codigoResp.StartsWith("TB2-OB2-2026-"), $"Código regenerado: {codigoResp}");
        Assert.EndsWith("0010", codigoResp);

        var norma = await db.Normas.AsNoTracking().FirstAsync(n => n.Id == normaId);
        Assert.Equal("TB2-OB2-2026-0010", norma.CodigoNormalizado);
        Assert.Equal(0, norma.Numero);
    }

    [Fact]
    public async Task Actualizar_NumeroYaOcupado_Devuelve409ConProximoLibre()
    {
        var (db, normaId) = await PrepararAsync();
        var controlador = CrearControlador(db);

        var resultado = await controlador.Actualizar(normaId, new ActualizarNormaRequest(
            null, 3, null, null, null, null,
            null, null, null, null, null, null, null), CancellationToken.None);

        var problema = Assert.IsType<ObjectResult>(resultado);
        Assert.Equal((int)HttpStatusCode.Conflict, problema.StatusCode);
        var detalle = Assert.IsType<ProblemDetails>(problema.Value);
        Assert.Contains("Ya existe una norma con el código TB1-OB1-2026-0003", detalle.Detail);
        Assert.Contains("el próximo número libre para este tipo/órgano/año es 1", detalle.Detail);
    }
}
