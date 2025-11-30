### NuGet Package Source Issue

If you encounter errors during `npm run install` related to NuGet packages not being resolved (such as `Unable to resolve 'DocumentFormat.OpenXml'`, `Microsoft.JavaScript.NodeApi`, etc.), this is likely because no NuGet package sources are configured on your system.

**Solution:**
Add the default NuGet.org package source:

```bash
dotnet nuget add source https://api.nuget.org/v3/index.json --name nuget.org
```

After adding the source, run the install command again:

```bash
npm run install
```

This will properly restore the required NuGet packages and download the necessary dependencies (yt-dlp, FFmpeg, .NET runtime) for the application.
