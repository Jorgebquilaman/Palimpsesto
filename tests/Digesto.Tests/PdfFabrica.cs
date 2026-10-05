using System.Text;

namespace Digesto.Tests;

public static class PdfFabrica
{
    private static readonly Dictionary<char, byte> WinAnsi = new()
    {
        ['á'] = 0xE1, ['é'] = 0xE9, ['í'] = 0xED, ['ó'] = 0xF3, ['ú'] = 0xFA,
        ['Á'] = 0xC1, ['É'] = 0xC9, ['Í'] = 0xCD, ['Ó'] = 0xD3, ['Ú'] = 0xDA,
        ['ñ'] = 0xF1, ['Ñ'] = 0xD1, ['º'] = 0xBA, ['°'] = 0xB0,
    };

    public static byte[] Generar(params string[] lineas)
    {
        var contenido = new StringBuilder();
        contenido.Append("BT /F1 12 Tf 72 740 Td 14 TL\n");
        foreach (var linea in lineas)
        {
            contenido.Append($"({EscaparWinAnsi(linea)}) Tj T*\n");
        }
        contenido.Append("ET");

        var contenidoBytes = Encoding.Latin1.GetBytes(contenido.ToString());

        var objetos = new List<string>
        {
            "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
            $"<< /Length {contenidoBytes.Length} >>\nstream\n{Encoding.Latin1.GetString(contenidoBytes)}\nendstream",
        };

        var pdf = new StringBuilder();
        pdf.Append("%PDF-1.4\n");
        var offsets = new List<int>();
        for (var i = 0; i < objetos.Count; i++)
        {
            offsets.Add(Encoding.Latin1.GetByteCount(pdf.ToString()));
            pdf.Append($"{i + 1} 0 obj\n{objetos[i]}\nendobj\n");
        }

        var inicioXref = Encoding.Latin1.GetByteCount(pdf.ToString());
        pdf.Append($"xref\n0 {objetos.Count + 1}\n");
        pdf.Append("0000000000 65535 f \n");
        foreach (var offset in offsets)
        {
            pdf.Append($"{offset:D10} 00000 n \n");
        }
        pdf.Append($"trailer\n<< /Size {objetos.Count + 1} /Root 1 0 R >>\nstartxref\n{inicioXref}\n%%EOF\n");

        return Encoding.Latin1.GetBytes(pdf.ToString());
    }

    private static string EscaparWinAnsi(string texto)
    {
        var sb = new StringBuilder();
        foreach (var c in texto)
        {
            if (c is '(' or ')' or '\\')
            {
                sb.Append('\\').Append(c);
            }
            else if (WinAnsi.TryGetValue(c, out var codigo))
            {
                sb.Append('\\').Append(Convert.ToString(codigo, 8).PadLeft(3, '0'));
            }
            else if (c < 128)
            {
                sb.Append(c);
            }
            else
            {
                sb.Append('?');
            }
        }
        return sb.ToString();
    }
}
