using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Digesto.Infrastructure.Persistencia;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<DigestoDbContext>
{
    public DigestoDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<DigestoDbContext>()
            .UseNpgsql("Host=localhost;Port=5433;Database=digesto_design;Username=digesto;Password=digesto_dev")
            .UseSnakeCaseNamingConvention()
            .Options;
        return new DigestoDbContext(options);
    }
}
