namespace Digesto.Domain.Reglas;

/// <summary>
/// Arma el código normalizado público de una norma a partir de sus metadatos.
/// Formato: TIPO-ORGANO-ANIO-NUMERO (número rellenado a 4 dígitos).
/// Solo aplica cuando la norma tiene número (> 0); los borradores sin número
/// conservan el código autonumérico temporal con el que fueron cargados.
/// </summary>
public static class CodigoNormalizador
{
    public static string Armar(string codigoTipo, string codigoOrgano, short anio, int numero)
    {
        return $"{codigoTipo}-{codigoOrgano}-{anio}-{numero:D4}";
    }
}
