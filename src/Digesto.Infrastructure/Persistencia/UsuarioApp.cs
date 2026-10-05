using Microsoft.AspNetCore.Identity;

namespace Digesto.Infrastructure.Persistencia;

public class UsuarioApp : IdentityUser
{
    public string Nombre { get; set; } = null!;
}
