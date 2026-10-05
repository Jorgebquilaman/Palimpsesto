using Digesto.Application.Ai;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Digesto.Api.Controllers;

[ApiController]
[Route("api/v1/admin/ai")]
[Authorize(Roles = "admin")]
public class AiAdminController : ControllerBase
{
    private readonly IConfiguracionAi _configuracion;
    private readonly IProveedorAi _proveedor;
    private readonly IAiNormaService _aiNorma;

    public AiAdminController(IConfiguracionAi configuracion, IProveedorAi proveedor, IAiNormaService aiNorma)
    {
        _configuracion = configuracion;
        _proveedor = proveedor;
        _aiNorma = aiNorma;
    }

    [HttpGet]
    public async Task<IActionResult> Estado(CancellationToken ct)
    {
        var config = await _configuracion.LeerAsync(ct);
        if (config is null || string.IsNullOrEmpty(config.ClaveApi))
        {
            return Ok(new { configurada = false, modelo = "deepseek-chat", clave = (string?)null });
        }

        var clave = config.ClaveApi;
        return Ok(new
        {
            configurada = true,
            config.Modelo,
            clave = clave.Length <= 8 ? "••••" : $"••••{clave[^4..]}",
        });
    }

    [HttpPut]
    public async Task<IActionResult> Guardar([FromBody] GuardarConfiguracionAiRequest request, CancellationToken ct)
    {
        var actual = await _configuracion.LeerAsync(ct);
        var claveApi = string.IsNullOrWhiteSpace(request.ClaveApi) ? actual?.ClaveApi : request.ClaveApi.Trim();

        if (string.IsNullOrEmpty(claveApi))
        {
            return Problem(statusCode: 400, detail: "Falta la clave de la API de DeepSeek");
        }

        await _configuracion.GuardarAsync(
            new ConfiguracionAi(claveApi, request.Modelo ?? "deepseek-chat", request.BaseUrl ?? "https://api.deepseek.com"), ct);
        return Ok(new { configurada = true });
    }

    [HttpPost("probar")]
    public async Task<IActionResult> Probar(CancellationToken ct)
    {
        var ok = await _proveedor.ProbarConexionAsync(ct);
        return Ok(new { ok, detalle = ok ? "Conexión con DeepSeek correcta" : "No se pudo conectar; revisá la clave" });
    }

    [HttpPost("normas/{id:guid}/completar")]
    public async Task<IActionResult> CompletarNorma(Guid id, CancellationToken ct)
    {
        var resultado = await _aiNorma.CompletarNormaAsync(id, ct);
        if (!resultado.Ok)
        {
            return Problem(statusCode: 400, detail: resultado.Advertencias.FirstOrDefault() ?? "No se pudo completar");
        }

        return Ok(new
        {
            resultado.CamposAplicados,
            resultado.RelacionesCreadas,
            resultado.Advertencias,
        });
    }
}

public record GuardarConfiguracionAiRequest(string? ClaveApi, string? Modelo, string? BaseUrl);
