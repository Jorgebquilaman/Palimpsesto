namespace Digesto.Domain.Enums;

public enum Vigencia
{
    Vigente = 1,
    Modificada = 2,
    Derogada = 3,
    DerogadaParcialmente = 4,
    DejaSinEfecto = 5,
}

public enum Visibilidad
{
    Publica = 1,
    Interna = 2,
    Reservada = 3,
}

public enum EstadoPublicacion
{
    Borrador = 1,
    Procesando = 2,
    EnRevision = 3,
    Publicada = 4,
    Archivada = 5,
}

public enum TextoOrigen
{
    Nativo = 1,
    Ocr = 2,
}

public enum RolArchivo
{
    Original = 1,
    Ocr = 2,
    Anexo = 3,
    TextoOrdenado = 4,
}

public enum TipoFragmento
{
    Encabezado = 1,
    Visto = 2,
    Considerando = 3,
    ParteDispositiva = 4,
    Articulo = 5,
    Anexo = 6,
    Pagina = 7,
}

public enum TipoRelacion
{
    Modifica = 1,
    Deroga = 2,
    DerogaParcialmente = 3,
    Reglamenta = 4,
    Complementa = 5,
    Ratifica = 6,
    DejaSinEfecto = 7,
}

public enum EstadoProceso
{
    Pendiente = 1,
    EnCurso = 2,
    Ok = 3,
    Error = 4,
}
