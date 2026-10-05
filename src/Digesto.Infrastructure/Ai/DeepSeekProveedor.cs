using System.Net.Http.Json;
using System.Text.Json;
using Digesto.Application.Ai;
using Microsoft.Extensions.Http;

namespace Digesto.Infrastructure.Ai;

using Microsoft.Extensions.Logging;

public class DeepSeekProveedor : IProveedorAi
{
    private readonly IConfiguracionAi _configuracion;
    private readonly IHttpClientFactory _fabrica;
    private readonly ILogger<DeepSeekProveedor> _logger;

    private const string BasePorDefecto = "https://api.deepseek.com";
    private const string ModeloPorDefecto = "deepseek-chat";

    public DeepSeekProveedor(IConfiguracionAi configuracion, IHttpClientFactory fabrica, ILogger<DeepSeekProveedor> logger)
    {
        _configuracion = configuracion;
        _fabrica = fabrica;
        _logger = logger;
    }

    public async Task<string> CompletarAsync(string sistema, string usuario, TimeSpan timeout, CancellationToken ct = default)
    {
        var config = await _configuracion.LeerAsync(ct)
            ?? throw new InvalidOperationException("La API de DeepSeek no está configurada; cargá la clave en Inteligencia artificial");

        var cliente = _fabrica.CreateClient("deepseek");
        cliente.BaseAddress = new Uri((config.BaseUrl is { Length: > 0 } ? config.BaseUrl : BasePorDefecto).TrimEnd('/') + '/');
        cliente.Timeout = timeout;
        cliente.DefaultRequestHeaders.Authorization = new("Bearer", config.ClaveApi);

        var pedido = new
        {
            model = config.Modelo is { Length: > 0 } ? config.Modelo : ModeloPorDefecto,
            messages = new object[]
            {
                new { role = "system", content = sistema },
                new { role = "user", content = usuario },
            },
            response_format = new { type = "json_object" },
            temperature = 0.1,
            max_tokens = 4000,
        };

        var respuesta = await cliente.PostAsJsonAsync("chat/completions", pedido, ct);
        var cuerpo = await respuesta.Content.ReadAsStringAsync(ct);

        if (!respuesta.IsSuccessStatusCode)
        {
            _logger.LogWarning("DeepSeek respondió {Codigo}: {Cuerpo}", (int)respuesta.StatusCode, Truncar(cuerpo, 500));
            throw new InvalidOperationException(
                (int)respuesta.StatusCode == 401
                    ? "La clave de DeepSeek es inválida (401)"
                    : $"DeepSeek rechazó el pedido ({(int)respuesta.StatusCode})");
        }

        using var datos = JsonDocument.Parse(cuerpo);
        var contenido = datos.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();

        return contenido ?? "";
    }

    public async Task<bool> ProbarConexionAsync(CancellationToken ct = default)
    {
        try
        {
            var config = await _configuracion.LeerAsync(ct);
            if (config?.ClaveApi is null or { Length: 0 })
            {
                return false;
            }

            var cliente = _fabrica.CreateClient("deepseek");
            cliente.BaseAddress = new Uri((config.BaseUrl is { Length: > 0 } ? config.BaseUrl : BasePorDefecto).TrimEnd('/') + '/');
            cliente.Timeout = TimeSpan.FromSeconds(20);
            cliente.DefaultRequestHeaders.Authorization = new("Bearer", config.ClaveApi);

            var respuesta = await cliente.GetAsync("models", ct);
            return respuesta.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Prueba de conexión con DeepSeek falló");
            return false;
        }
    }

    private static string Truncar(string texto, int largo) => texto.Length <= largo ? texto : texto[..largo];
}
