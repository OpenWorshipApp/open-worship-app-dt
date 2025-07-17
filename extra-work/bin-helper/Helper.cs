using DocumentFormat.OpenXml.Packaging;
using Microsoft.JavaScript.NodeApi;

[JSExport]
public class Helper
{
    [JSExport]
    public static string SayHello(string name)
    {
        return $"Hello, {name} from C#!";
    }

    [JSExport]
    public static int CountSlides(string filePath)
    {
        using (PresentationDocument presentationDocument = PresentationDocument.Open(filePath, false))
        {
            return presentationDocument.PresentationPart != null
                ? presentationDocument.PresentationPart.SlideParts.Count()
                : 0;
        }
    }

    [JSExport]
    public static int Add(int a, int b)
    {
        return a + b;
    }
}
