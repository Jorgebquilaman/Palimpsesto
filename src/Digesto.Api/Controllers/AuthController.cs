using System.ComponentModel.DataAnnotations;
using Digesto.Infrastructure.Auth;
using Digesto.Infrastructure.Persistencia;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;

namespace Digesto.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly DigestoDbContext _db;
    private readonly SignInManager<UsuarioApp> _signInManager;
    private readonly UserManager<UsuarioApp> _userManager;
    private readonly TokenGenerator _tokenGenerator;

    public AuthController(
        DigestoDbContext db,
        SignInManager<UsuarioApp> signInManager,
        UserManager<UsuarioApp> userManager,
        TokenGenerator tokenGenerator)
    {
        _db = db;
        _signInManager = signInManager;
        _userManager = userManager;
        _tokenGenerator = tokenGenerator;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var usuario = await _userManager.FindByNameAsync(request.Usuario);
        if (usuario is null)
        {
            return Unauthorized();
        }

        var resultado = await _signInManager.CheckPasswordSignInAsync(usuario, request.Contrasenia, lockoutOnFailure: true);
        if (!resultado.Succeeded)
        {
            return Unauthorized();
        }

        var rol = (await _userManager.GetRolesAsync(usuario)).FirstOrDefault() ?? "";
        var token = _tokenGenerator.Generar(usuario.Id, usuario.Nombre, usuario.Email ?? "", rol);

        return Ok(new LoginResponse(token, usuario.Nombre, rol));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var usuarioId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        var usuario = await _userManager.FindByIdAsync(usuarioId);
        if (usuario is null)
        {
            return Unauthorized();
        }

        return Ok(new { usuario.UserName, usuario.Nombre, usuario.Email, roles = await _userManager.GetRolesAsync(usuario) });
    }
    [HttpPost("cambiar-contrasenia")]
    [Authorize]
    public async Task<IActionResult> CambiarContrasenia([FromBody] CambiarContraseniaRequest request, CancellationToken ct)
    {
        var usuarioId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (usuarioId is null)
        {
            return Unauthorized();
        }

        var usuario = await _userManager.FindByIdAsync(usuarioId);
        if (usuario is null)
        {
            return Unauthorized();
        }

        if (request.ContraseniaNueva != request.ContraseniaNuevaRepetida)
        {
            return Problem(statusCode: 400, detail: "La contraseña nueva y su repetición no coinciden");
        }

        var okActual = await _signInManager.CheckPasswordSignInAsync(usuario, request.ContraseniaActual, lockoutOnFailure: false);
        if (!okActual.Succeeded)
        {
            return Problem(statusCode: 400, detail: "La contraseña actual es incorrecta");
        }

        if (request.ContraseniaActual == request.ContraseniaNueva)
        {
            return Problem(statusCode: 400, detail: "La contraseña nueva debe ser distinta de la actual");
        }

        var resultado = await _userManager.ChangePasswordAsync(usuario, request.ContraseniaActual, request.ContraseniaNueva);
        if (!resultado.Succeeded)
        {
            return Problem(statusCode: 400, detail: string.Join(" ", resultado.Errors.Select(e => TraducirError(e.Description))));
        }

        return Ok(new { ok = true });
    }

    private static string TraducirError(string descripcion) => descripcion switch
    {
        var d when d.Contains("at least one non alphanumeric") => "Debe tener al menos un carácter no alfanumérico (por ejemplo ! - _).",
        var d when d.Contains("uppercase") => "Debe tener al menos una mayúscula.",
        var d when d.Contains("lowercase") => "Debe tener al menos una minúscula.",
        var d when d.Contains("digit") => "Debe tener al menos un dígito.",
        var d when d.Contains("must be at least") || d.Contains("minimum") => "Es demasiado corta (mínimo " + new string(d.Where(char.IsDigit).ToArray()) + " caracteres).",
        _ => descripcion,
    };

public record LoginRequest(string Usuario, string Contrasenia);
public record LoginResponse(string Token, string Nombre, string Rol);
public record CambiarContraseniaRequest(string ContraseniaActual, string ContraseniaNueva, string ContraseniaNuevaRepetida);
}
