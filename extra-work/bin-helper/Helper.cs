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
    public static void ExportBibleMSWord(string filePath, string title, string body)
    {
        using (WordprocessingDocument wordDocument = WordprocessingDocument.Create(
            filePath, DocumentFormat.OpenXml.WordprocessingDocumentType.Document))
        {
            var mainPart = wordDocument.AddMainDocumentPart();
            mainPart.Document = new DocumentFormat.OpenXml.Wordprocessing.Document();
            var bodyElement = mainPart.Document.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Body());

            var titleParagraph = bodyElement.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Paragraph());
            var titleRun = titleParagraph.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Run());
            titleRun.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Text(title));
            titleRun.RunProperties = new DocumentFormat.OpenXml.Wordprocessing.RunProperties();
            titleRun.RunProperties.Bold = new DocumentFormat.OpenXml.Wordprocessing.Bold();
            titleRun.RunProperties.FontSize = new DocumentFormat.OpenXml.Wordprocessing.FontSize() { Val = "32" }; // 16 * 2

            var bodyParagraph = bodyElement.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Paragraph());
            var bodyRun = bodyParagraph.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Run());
            bodyRun.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Text(body));
            bodyRun.RunProperties = new DocumentFormat.OpenXml.Wordprocessing.RunProperties();
            bodyRun.RunProperties.FontSize = new DocumentFormat.OpenXml.Wordprocessing.FontSize() { Val = "24" }; // 12 * 2
        }
    }

}
