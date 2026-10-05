using Digesto.Domain.Entidades;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Digesto.Infrastructure.Persistencia;

public class SeedDigesto
{
    private readonly DigestoDbContext _db;
    private readonly UserManager<UsuarioApp> _userManager;
    private readonly ILogger<SeedDigesto> _logger;

    public SeedDigesto(DigestoDbContext db, UserManager<UsuarioApp> userManager, ILogger<SeedDigesto> logger)
    {
        _db = db;
        _userManager = userManager;
        _logger = logger;
    }

    public async Task EjecutarAsync(CancellationToken ct = default)
    {
        await SembrarCatalogosAsync(ct);
        await SembrarRolesYUsuariosAsync(ct);
    }

    private async Task SembrarCatalogosAsync(CancellationToken ct)
    {
        if (!await _db.TiposNorma.AnyAsync(ct))
        {
            _db.TiposNorma.AddRange(new[]
            {
                new TipoNorma { Codigo = "ORD", Nombre = "Ordenanza", Alcance = "general" },
                new TipoNorma { Codigo = "RES", Nombre = "Resolución", Alcance = "general" },
                new TipoNorma { Codigo = "DEC", Nombre = "Declaración", Alcance = "general" },
                new TipoNorma { Codigo = "DIS", Nombre = "Disposición", Alcance = "general" },
                new TipoNorma { Codigo = "DIC", Nombre = "Dictamen", Alcance = "general" },
                new TipoNorma { Codigo = "PRO", Nombre = "Providencia", Alcance = "general" },
                new TipoNorma { Codigo = "ACT", Nombre = "Acta", Alcance = "particular" },
                new TipoNorma { Codigo = "CON", Nombre = "Convenio", Alcance = "general" },
                new TipoNorma { Codigo = "ANX", Nombre = "Anexo", Alcance = "particular" },
            });
            _logger.LogInformation("Seed: catálogo tipo_norma cargado (SEED EDITABLE)");
        }

        if (!await _db.OrganosEmisores.AnyAsync(ct))
        {
            var consejoSuperior = new OrganoEmisor { Codigo = "CS", Nombre = "Consejo Superior" };
            var rectorado = new OrganoEmisor { Codigo = "REC", Nombre = "Rectorado" };
            var vicerrectorado = new OrganoEmisor { Codigo = "VIR", Nombre = "Vicerrectorado", Padre = rectorado };
            var secretariaAcademica = new OrganoEmisor { Codigo = "SEC-AC", Nombre = "Secretaría Académica", Padre = rectorado };
            var secretariaAdministrativa = new OrganoEmisor { Codigo = "SEC-AD", Nombre = "Secretaría Administrativa", Padre = rectorado };
            var secretariaExtension = new OrganoEmisor { Codigo = "SEC-EX", Nombre = "Secretaría de Extensión", Padre = rectorado };
            var secretariaInvestigacion = new OrganoEmisor { Codigo = "SEC-INV", Nombre = "Secretaría de Investigación", Padre = rectorado };

            _db.OrganosEmisores.AddRange(consejoSuperior, rectorado, vicerrectorado, secretariaAcademica,
                secretariaAdministrativa, secretariaExtension, secretariaInvestigacion);
            _logger.LogInformation("Seed: catálogo organo_emisor cargado (SEED EDITABLE)");
        }

        if (!await _db.Materias.AnyAsync(ct))
        {
            var docencia = new Materia { Nombre = "Docencia", Slug = "docencia" };
            var investigacion = new Materia { Nombre = "Investigación", Slug = "investigacion" };
            var extension = new Materia { Nombre = "Extensión", Slug = "extension" };
            var administracion = new Materia { Nombre = "Administración", Slug = "administracion" };
            var concursos = new Materia { Nombre = "Concursos", Slug = "concursos", Padre = administracion };

            _db.Materias.AddRange(docencia, investigacion, extension, administracion, concursos);
            _logger.LogInformation("Seed: estructura de materias cargada (SEED EDITABLE)");
        }

        await _db.SaveChangesAsync(ct);
    }

    private async Task SembrarRolesYUsuariosAsync(CancellationToken ct)
    {
        foreach (var rol in new[] { "admin", "editor", "revisor" })
        {
            if (!await _db.Roles.AnyAsync(r => r.Name == rol, ct))
            {
                _db.Roles.Add(new IdentityRole(rol) { NormalizedName = rol.ToUpperInvariant() });
            }
        }
        await _db.SaveChangesAsync(ct);

        var admin = await _userManager.FindByNameAsync("admin");
        if (admin is null)
        {
            var password = Environment.GetEnvironmentVariable("SEED_ADMIN_PASSWORD") ?? "Iupa2026!";
            admin = new UsuarioApp
            {
                UserName = "admin",
                Email = "admin@iupa.local",
                Nombre = "Administrador",
                EmailConfirmed = true,
            };
            var resultado = await _userManager.CreateAsync(admin, password);
            if (!resultado.Succeeded)
            {
                _logger.LogError("Seed: no se pudo crear el usuario admin: {Errores}",
                    string.Join(", ", resultado.Errors.Select(e => e.Description)));
                return;
            }
            await _userManager.AddToRoleAsync(admin, "admin");
            _logger.LogInformation("Seed: usuario admin creado (SEED EDITABLE, cambiar contraseña)");
        }
    }
}
