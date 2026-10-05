namespace Digesto.Application.Ai;

public record ConfiguracionAi(string? ClaveApi, string Modelo, string BaseUrl);

public interface IConfiguracionAi
{
    Task<ConfiguracionAi?> LeerAsync(CancellationToken ct = default);
    Task GuardarAsync(ConfiguracionAi configuracion, CancellationToken ct = default);
}

public interface IProveedorAi
{
    Task<string> CompletarAsync(string sistema, string usuario, TimeSpan timeout, CancellationToken ct = default);
    Task<string> CompletarConImagenesAsync(string sistema, string usuario, IReadOnlyList<byte[]> imagenesPng, TimeSpan timeout, CancellationToken ct = default);
    Task<bool> ProbarConexionAsync(CancellationToken ct = default);
}
