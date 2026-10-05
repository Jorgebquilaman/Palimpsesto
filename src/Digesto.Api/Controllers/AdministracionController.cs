using Digesto.Infrastructure.Persistencia;
using UsuarioApp = Digesto.Infrastructure.Persistencia.UsuarioApp;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Digesto.Api.Controllers;

[ApiController]
[Route("api/v1/admin")]
[Authorize(Roles = "admin")]
public class AdministracionController : ControllerBase
{
    private readonly DigestoDbContext _db;

    public AdministracionController(DigestoDbContext db)
    {
        _db = db;
    }

    [HttpGet("auditoria")]
    public async Task<IActionResult> Auditoria([FromQuery] int page = 1, CancellationToken ct = default)
    {
        var registros = await _db.Auditorias
            .AsNoTracking()
            .OrderByDescending(a => a.Id)
            .Skip((Math.Max(1, page) - 1) * 100)
            .Take(100)
            .Select(a => new
            {
                a.Id,
                a.Usuario,
                a.Entidad,
                a.EntidadId,
                a.Accion,
                a.Antes,
                a.Despues,
                a.Fecha,
            })
            .ToListAsync(ct);

        return Ok(registros);
    }

    [HttpGet("usuarios")]
    public async Task<IActionResult> Usuarios(CancellationToken ct)
    {
        var roles = await _db.Roles.ToDictionaryAsync(r => r.Id, r => r.Name!, ct);
        var usuarios = await _db.Users
            .AsNoTracking()
            .Select(u => new { u.Id, u.UserName, u.Nombre, u.Email, u.LockoutEnd })
            .ToListAsync(ct);

        var userRoles = await _db.UserRoles.ToListAsync(ct);

        return Ok(usuarios.Select(u => new
        {
            u.Id,
            u.UserName,
            u.Nombre,
            u.Email,
            Rol = userRoles.FirstOrDefault(ur => ur.UserId == u.Id) is { } ur && roles.TryGetValue(ur.RoleId, out var rol) ? rol : "",
            Bloqueado = u.LockoutEnd.HasValue && u.LockoutEnd > DateTimeOffset.UtcNow,
        }));
    }

    [HttpPost("usuarios")]
    public async Task<IActionResult> CrearUsuario([FromBody] CrearUsuarioRequest request, CancellationToken ct)
    {
        var validos = new[] { "admin", "editor", "revisor" };
        if (!validos.Contains(request.Rol))
        {
            return Problem(statusCode: 400, detail: "Rol inválido");
        }

        var existe = await _db.Users.AnyAsync(u => u.UserName == request.Usuario, ct);
        if (existe)
        {
            return Problem(statusCode: 409, detail: "Ya existe ese usuario");
        }

        var userManager = HttpContext.RequestServices.GetRequiredService<UserManager<UsuarioApp>>();
        var usuario = new UsuarioApp
        {
            UserName = request.Usuario,
            Email = request.Email,
            Nombre = request.Nombre,
        };
        var resultado = await userManager.CreateAsync(usuario, request.Contrasenia);
        if (!resultado.Succeeded)
        {
            return Problem(statusCode: 400, detail: string.Join("; ", resultado.Errors.Select(e => e.Description)));
        }

        await userManager.AddToRoleAsync(usuario, request.Rol);
        return StatusCode(201, new { usuario.UserName, request.Rol });
    }
}

public record CrearUsuarioRequest(string Usuario, string Email, string Nombre, string Contrasenia, string Rol);
