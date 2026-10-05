using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Digesto.Infrastructure.Auth;

public class TokenGenerator
{
    private readonly TokenOptions _opciones;

    public TokenGenerator(IOptions<TokenOptions> opciones)
    {
        _opciones = opciones.Value;
    }

    public string Generar(string usuarioId, string nombre, string email, string rol)
    {
        if (string.IsNullOrEmpty(_opciones.Clave) || _opciones.Clave.Length < 32)
        {
            throw new InvalidOperationException("Falta configurar Jwt:Clave (mínimo 32 caracteres)");
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, usuarioId),
            new(ClaimTypes.Name, nombre),
            new(JwtRegisteredClaimNames.Email, email),
            new(ClaimTypes.Role, rol),
        };

        var credenciales = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_opciones.Clave)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _opciones.Emisor,
            audience: _opciones.Publico,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_opciones.MinutosValidez),
            signingCredentials: credenciales);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
