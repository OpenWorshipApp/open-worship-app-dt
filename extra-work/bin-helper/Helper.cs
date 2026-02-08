// https://microsoft.github.io/node-api-dotnet/scenarios/
// https://www.nuget.org/packages/DocumentFormat.OpenXml
// https://learn.microsoft.com/en-us/office/open-xml/open-xml-sdk
using DocumentFormat.OpenXml.Packaging;
using Microsoft.JavaScript.NodeApi;

public class BibleData
{
    public string title { get; set; }
    public string body { get; set; }
    public string fontFamily { get; set; }
}

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
    public static bool RemoveSlideBackground(string filePath)
    {
        using (PresentationDocument presentationDocument = PresentationDocument.Open(filePath, true))
        {
            if (presentationDocument.PresentationPart == null)
            {
                return false;
            }
            // remove all slide backgrounds then set to white transparent 100%
            foreach (var slidePart in presentationDocument.PresentationPart.SlideParts)
            {
                if (slidePart.Slide.CommonSlideData == null)
                {
                    continue;
                }
                // set background to solid fill white and alpha 0
                slidePart.Slide.CommonSlideData.Background = new DocumentFormat.OpenXml.Presentation.Background(
                    new DocumentFormat.OpenXml.Presentation.BackgroundProperties(
                        new DocumentFormat.OpenXml.Drawing.SolidFill(
                            new DocumentFormat.OpenXml.Drawing.RgbColorModelHex() { Val = "FFFFFF" },
                            new DocumentFormat.OpenXml.Drawing.Alpha() { Val = 0 }
                        )
                    )
                );
            }
            presentationDocument.Save();
            return true;
        }
    }

    private static void SetRunFontFamily(
        DocumentFormat.OpenXml.Wordprocessing.RunProperties runProperties,
        string fontFamily
    )
    {
        runProperties.RunFonts = new DocumentFormat.OpenXml.Wordprocessing.RunFonts()
        {
            Ascii = fontFamily,
            HighAnsi = fontFamily,
            EastAsia = fontFamily,
            ComplexScript = fontFamily
        };
    }


    private static void AppendBibleEntryToWordBody(
        DocumentFormat.OpenXml.Wordprocessing.Body bodyElement,
        string title,
        string body,
        string fontFamily
    )
    {
        var titleParagraph = bodyElement.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Paragraph());
        var titleRun = titleParagraph.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Run());
        titleRun.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Text(title));
        titleRun.RunProperties = new DocumentFormat.OpenXml.Wordprocessing.RunProperties();
        titleRun.RunProperties.Bold = new DocumentFormat.OpenXml.Wordprocessing.Bold();
        titleRun.RunProperties.FontSize = new DocumentFormat.OpenXml.Wordprocessing.FontSize() { Val = "28" }; // 14 * 2

        var bodyParagraph = bodyElement.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Paragraph());
        var bodyRun = bodyParagraph.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Run());
        bodyRun.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Text(body));
        bodyRun.RunProperties = new DocumentFormat.OpenXml.Wordprocessing.RunProperties();
        bodyRun.RunProperties.FontSize = new DocumentFormat.OpenXml.Wordprocessing.FontSize() { Val = "24" }; // 12 * 2

        if(fontFamily != "")
        {
            SetRunFontFamily(titleRun.RunProperties, fontFamily);
            SetRunFontFamily(bodyRun.RunProperties, fontFamily);
        }

        bodyElement.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Paragraph());
        bodyElement.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Paragraph()); 
    }

    [JSExport]
    public static void ExportBibleMSWord(string filePath, List<Dictionary<string, string>> data)
    {
        using (WordprocessingDocument wordDocument = WordprocessingDocument.Create(
            filePath, DocumentFormat.OpenXml.WordprocessingDocumentType.Document))
        {
            var mainPart = wordDocument.AddMainDocumentPart();
            mainPart.Document = new DocumentFormat.OpenXml.Wordprocessing.Document();
            var bodyElement = mainPart.Document.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Body());

            foreach (var entry in data)
            {
                AppendBibleEntryToWordBody(bodyElement, entry["title"], entry["body"], entry["fontFamily"]);
            }
        }
    }

}
