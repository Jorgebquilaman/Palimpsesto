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
    private const string ModeloVision = "deepseek-v4-flash-vision-exp";

    public DeepSeekProveedor(IConfiguracionAi configuracion, IHttpClientFactory fabrica, ILogger<DeepSeekProveedor> logger)
    {
        _configuracion = configuracion;
        _fabrica = fabrica;
        _logger = logger;
    }

    public async Task<string> CompletarAsync(string sistema, string usuario, TimeSpan timeout, CancellationToken ct = default)
    {
        return await EnviarAsync(sistema, usuario, imagenes: null, timeout, ct);
    }

    public async Task<string> CompletarConImagenesAsync(string sistema, string usuario, IReadOnlyList<byte[]> imagenesPng, TimeSpan timeout, CancellationToken ct = default)
    {
        return await EnviarAsync(sistema, usuario, imagenesPng, timeout, ct);
    }

    private async Task<string> EnviarAsync(string sistema, string usuario, IReadOnlyList<byte[]>? imagenes, TimeSpan timeout, CancellationToken ct)
    {
        var config = await _configuracion.LeerAsync(ct)
            ?? throw new InvalidOperationException("La API de DeepSeek no está configurada; cargá la clave en Inteligencia artificial");

        var modelo = config.Modelo is { Length: > 0 } ? config.Modelo : ModeloPorDefecto;
        if (imagenes is { Count: > 0 })
        {
            modelo = ModeloVision;
        }

        var cliente = _fabrica.CreateClient("deepseek");
        cliente.BaseAddress = new Uri((config.BaseUrl is { Length: > 0 } ? config.BaseUrl : BasePorDefecto).TrimEnd('/') + '/');
        cliente.Timeout = timeout;
        cliente.DefaultRequestHeaders.Authorization = new("Bearer", config.ClaveApi);

        var bloqueTexto = new Dictionary<string, object> { ["type"] = "text", ["text"] = usuario };
        var bloques = new List<object> { bloqueTexto };
        foreach (var imagen in imagenes ?? [])
        {
            bloques.Add(new Dictionary<string, object>
            {
                ["type"] = "image_url",
                ["image_url"] = new Dictionary<string, string> { ["url"] = $"data:image/png;base64,{Convert.ToBase64String(imagen)}" },
            });
        }

        var pedido = new
        {
            model = modelo,
            messages = new object[]
            {
                new { role = "system", content = sistema },
                new { role = "user", content = bloques },
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
