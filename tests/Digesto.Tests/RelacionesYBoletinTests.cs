using Dapper;
using Digesto.Domain.Entidades;
using Digesto.Domain.Enums;
using Digesto.Infrastructure.Persistencia;
using Microsoft.EntityFrameworkCore;

namespace Digesto.Tests;

public class RelacionesYBoletinTests : IClassFixture<MigracionYBusquedaFixture>
{
    private static readonly SemaphoreSlim SemillaLock = new(1, 1);
    private DigestoDbContext? _db2;
    private readonly MigracionYBusquedaFixture _fixture;

    public RelacionesYBoletinTests(MigracionYBusquedaFixture fixture)
    {
        _fixture = fixture;
    }

    private async Task<DigestoDbContext> DbAsync()
    {
        await SemillaLock.WaitAsync();
        try
        {
            if (_db2 is not null)
            {
                return _db2;
            }
            var options = new DbContextOptionsBuilder<DigestoDbContext>()
                .UseNpgsql(_fixture.CadenaConexion)
                .UseSnakeCaseNamingConvention()
                .Options;
            var db = new DigestoDbContext(options);
            await db.Database.MigrateAsync();
            _db2 = db;
            return _db2;
        }
        finally
        {
            SemillaLock.Release();
        }
    }

    private async Task<Norma> NormaAsync(string codigo, Visibilidad visibilidad = Visibilidad.Publica)
    {
        var db = await DbAsync();
        var tipo = await db.TiposNorma.FirstOrDefaultAsync();
        if (tipo is null)
        {
            tipo = new TipoNorma { Codigo = "RES", Nombre = "Resolución" };
            db.TiposNorma.Add(tipo);
            db.OrganosEmisores.Add(new OrganoEmisor { Codigo = "CS", Nombre = "Consejo Superior" });
            await db.SaveChangesAsync();
            tipo = await db.TiposNorma.OrderBy(t => t.Id).FirstAsync();
        }
        var organo = await db.OrganosEmisores.OrderBy(o => o.Id).FirstAsync();
        var norma = new Norma
        {
            Id = Guid.NewGuid(),
            TipoNormaId = tipo.Id,
            OrganoEmisorId = organo.Id,
            Numero = Random.Shared.Next(1000, 9999),
            Anio = (short)(2000 + Random.Shared.Next(0, 20)),
            CodigoNormalizado = codigo,
            Titulo = $"Norma {codigo}",
            FechaSancion = new DateOnly(2022, 5, 1),
            Visibilidad = visibilidad,
            EstadoPublicacion = EstadoPublicacion.Publicada,
            TextoOrigen = TextoOrigen.Nativo,
            CreadoEn = DateTime.UtcNow,
            CreadoPor = "test",
        };
        db.Normas.Add(norma);
        await db.SaveChangesAsync();
        return norma;
    }

    [Fact]
    public async Task BoletinNoMuestraNormasReservadas()
    {
        var db = await DbAsync();

        var boletin = new Boletin
        {
            Numero = $"BO-{Guid.NewGuid().ToString("N")[..8]}",
            FechaPublicacion = new DateOnly(2024, 4, 1),
        };
        db.Boletines.Add(boletin);

        var publica = await NormaAsync($"RES-P-{Guid.NewGuid().ToString("N")[..6]}");
        var reservada = await NormaAsync($"RES-R-{Guid.NewGuid().ToString("N")[..6]}", Visibilidad.Reservada);
        db.Normas.Where(n => n.Id == publica.Id).ExecuteUpdate(s => s.SetProperty(n => n.BoletinId, boletin.Id));
        db.Normas.Where(n => n.Id == reservada.Id).ExecuteUpdate(s => s.SetProperty(n => n.BoletinId, boletin.Id));

        await db.SaveChangesAsync();

        var con = new Npgsql.NpgsqlConnection(_fixture.CadenaConexion);
        await con.OpenAsync();

        var normasConVisibilidadPublica = (await con.QueryAsync<(string, int)>("""
            SELECT n.codigo_normalizado, n.visibilidad
            FROM norma n
            WHERE n.boletin_id = (SELECT id FROM boletin WHERE numero = @n)
            """, new { n = boletin.Numero })).ToList();

        Assert.Contains(normasConVisibilidadPublica, t => t.Item2 == (int)Visibilidad.Publica);
        Assert.Contains(normasConVisibilidadPublica, t => t.Item2 == (int)Visibilidad.Reservada);

        var visibles = normasConVisibilidadPublica
            .Where(t => t.Item2 == (int)Visibilidad.Publica)
            .Select(t => t.Item1)
            .ToList();

        Assert.Single(visibles);
    }

    [Fact]
    public async Task RelacionUnicaPorTripla()
    {
        var db = await DbAsync();
        var origen = await NormaAsync($"RES-O-{Guid.NewGuid().ToString("N")[..6]}");
        var destino = await NormaAsync($"RES-D-{Guid.NewGuid().ToString("N")[..6]}");

        db.NormasRelaciones.Add(new NormaRelacion
        {
            NormaOrigenId = origen.Id,
            NormaDestinoId = destino.Id,
            Tipo = TipoRelacion.Modifica,
        });
        await db.SaveChangesAsync();

        db.NormasRelaciones.Add(new NormaRelacion
        {
            NormaOrigenId = origen.Id,
            NormaDestinoId = destino.Id,
            Tipo = TipoRelacion.Deroga,
        });
        await db.SaveChangesAsync();

        db.NormasRelaciones.Add(new NormaRelacion
        {
            NormaOrigenId = origen.Id,
            NormaDestinoId = destino.Id,
            Tipo = TipoRelacion.Modifica,
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }
}
