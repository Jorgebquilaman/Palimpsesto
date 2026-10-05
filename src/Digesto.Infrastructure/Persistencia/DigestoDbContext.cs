using Digesto.Domain.Entidades;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Digesto.Infrastructure.Persistencia;

public class DigestoDbContext : IdentityDbContext<UsuarioApp>
{
    public DigestoDbContext(DbContextOptions<DigestoDbContext> options) : base(options)
    {
    }

    public DbSet<TipoNorma> TiposNorma => Set<TipoNorma>();
    public DbSet<OrganoEmisor> OrganosEmisores => Set<OrganoEmisor>();
    public DbSet<Materia> Materias => Set<Materia>();
    public DbSet<Boletin> Boletines => Set<Boletin>();
    public DbSet<Norma> Normas => Set<Norma>();
    public DbSet<NormaArchivo> NormasArchivos => Set<NormaArchivo>();
    public DbSet<NormaFragmento> NormasFragmentos => Set<NormaFragmento>();
    public DbSet<NormaRelacion> NormasRelaciones => Set<NormaRelacion>();
    public DbSet<ProcesoIngesta> ProcesosIngesta => Set<ProcesoIngesta>();
    public DbSet<ConsultaBusqueda> ConsultasBusqueda => Set<ConsultaBusqueda>();
    public DbSet<Auditoria> Auditorias => Set<Auditoria>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.HasPostgresExtension("unaccent");
        modelBuilder.HasPostgresExtension("pg_trgm");

        modelBuilder.Entity<UsuarioApp>().ToTable("usuarios");
        modelBuilder.Entity<Microsoft.AspNetCore.Identity.IdentityRole>().ToTable("roles");
        modelBuilder.Entity<Microsoft.AspNetCore.Identity.IdentityUserRole<string>>().ToTable("usuarios_roles");
        modelBuilder.Entity<Microsoft.AspNetCore.Identity.IdentityUserClaim<string>>().ToTable("usuarios_claims");
        modelBuilder.Entity<Microsoft.AspNetCore.Identity.IdentityUserLogin<string>>().ToTable("usuarios_logins");
        modelBuilder.Entity<Microsoft.AspNetCore.Identity.IdentityUserToken<string>>().ToTable("usuarios_tokens");
        modelBuilder.Entity<Microsoft.AspNetCore.Identity.IdentityRoleClaim<string>>().ToTable("roles_claims");

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(DigestoDbContext).Assembly);
    }
}
