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
}

public record LoginRequest(string Usuario, string Contrasenia);
public record LoginResponse(string Token, string Nombre, string Rol);
