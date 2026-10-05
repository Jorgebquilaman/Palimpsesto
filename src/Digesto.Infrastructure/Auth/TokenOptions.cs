namespace Digesto.Infrastructure.Auth;

public class TokenOptions
{
    public const string Seccion = "Jwt";
    public string Clave { get; set; } = null!;
    public string Emisor { get; set; } = "digesto-iupa";
    public string Publico { get; set; } = "digesto-iupa";
    public int MinutosValidez { get; set; } = 480;
}
