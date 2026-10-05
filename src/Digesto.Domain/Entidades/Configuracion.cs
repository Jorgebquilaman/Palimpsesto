namespace Digesto.Domain.Entidades;

public class Configuracion
{
    public string Clave { get; set; } = null!;
    public string Valor { get; set; } = null!;
    public DateTime ActualizadoEn { get; set; }
}
