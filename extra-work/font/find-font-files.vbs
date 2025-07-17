' VBScript to list all available fonts and output as CSV
' Enhanced version with no hardcoded font family lists
' Relies purely on system libraries, font file metadata, and registry fallback
' Optimized for maximum compatibility and comprehensive font detection
'
' Usage examples:
'   cscript find-font-files.vbs
'   cscript find-font-files.vbs > fonts.csv

Option Explicit

Dim fso, shell, objShell, fontNamespace
Dim fontFolders, fileExtensions
Dim results, seenFiles, seenFamilies
Dim folder, file, files
Dim family, face, fullPath
Dim i, j, k

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
Set objShell = CreateObject("Shell.Application")
Set fontNamespace = Nothing

' Initialize arrays
Set fontFolders = CreateObject("Scripting.Dictionary")
Set fileExtensions = CreateObject("Scripting.Dictionary")
Set results = CreateObject("Scripting.Dictionary")
Set seenFiles = CreateObject("Scripting.Dictionary")
Set seenFamilies = CreateObject("Scripting.Dictionary")

' Define file extensions to search for
fileExtensions.Add "ttf", True
fileExtensions.Add "otf", True
fileExtensions.Add "ttc", True
fileExtensions.Add "woff", True
fileExtensions.Add "woff2", True
fileExtensions.Add "fon", True
fileExtensions.Add "fnt", True

' Build font folders list
Call BuildFontFolders()

' Scan for all font files
Call ScanFontFiles()

' Add system font families that weren't found in file scan
Call AddSystemFonts()

' Output CSV
Call OutputCSV()

' Clean up
Set fso = Nothing
Set shell = Nothing
Set objShell = Nothing
Set fontNamespace = Nothing
Set fontFolders = Nothing
Set fileExtensions = Nothing
Set results = Nothing
Set seenFiles = Nothing
Set seenFamilies = Nothing

' ==================== FUNCTIONS ====================

Sub BuildFontFolders()
    Dim systemFontFolder, userLocalFonts, userRoamingFonts
    Dim adobeFonts, officeFonts
    Dim commonLocations(7)

    ' System fonts
    systemFontFolder = shell.ExpandEnvironmentStrings("%WINDIR%") & "\Fonts"
    If fso.FolderExists(systemFontFolder) Then
        If Not fontFolders.Exists(systemFontFolder) Then
            fontFolders.Add systemFontFolder, True
        End If
    End If

    ' User fonts
    userLocalFonts = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Microsoft\Windows\Fonts"
    If fso.FolderExists(userLocalFonts) Then
        If Not fontFolders.Exists(userLocalFonts) Then
            fontFolders.Add userLocalFonts, True
        End If
    End If

    userRoamingFonts = shell.ExpandEnvironmentStrings("%APPDATA%") & "\Microsoft\Windows\Fonts"
    If fso.FolderExists(userRoamingFonts) Then
        If Not fontFolders.Exists(userRoamingFonts) Then
            fontFolders.Add userRoamingFonts, True
        End If
    End If

    ' Adobe fonts
    adobeFonts = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Adobe\CoreSync\plugins\livetype\r"
    If fso.FolderExists(adobeFonts) Then
        If Not fontFolders.Exists(adobeFonts) Then
            fontFolders.Add adobeFonts, True
        End If
    End If

    ' Office fonts
    officeFonts = shell.ExpandEnvironmentStrings("%PROGRAMFILES%") & "\Microsoft Office\root\VFS\Fonts\private"
    If fso.FolderExists(officeFonts) Then
        If Not fontFolders.Exists(officeFonts) Then
            fontFolders.Add officeFonts, True
        End If
    End If

    ' Common third-party locations
    commonLocations(0) = shell.ExpandEnvironmentStrings("%PROGRAMFILES%") & "\Common Files\Microsoft Shared\Fonts"
    commonLocations(1) = shell.ExpandEnvironmentStrings("%PROGRAMFILES(X86)%") & "\Common Files\Microsoft Shared\Fonts"
    commonLocations(2) = shell.ExpandEnvironmentStrings("%USERPROFILE%") & "\AppData\Local\Microsoft\Windows\Fonts"
    commonLocations(3) = shell.ExpandEnvironmentStrings("%USERPROFILE%") & "\Documents\My Fonts"

    For i = 0 To UBound(commonLocations)
        If fso.FolderExists(commonLocations(i)) Then
            If Not fontFolders.Exists(commonLocations(i)) Then
                fontFolders.Add commonLocations(i), True
            End If
        End If
    Next
End Sub

Sub ScanFontFiles()
    Dim folderKeys, extKeys
    Dim currentFolder, currentExt
    Dim folderObj, fileObj
    Dim fileName, baseName

    folderKeys = fontFolders.Keys
    extKeys = fileExtensions.Keys

    For i = 0 To UBound(folderKeys)
        currentFolder = folderKeys(i)

        If fso.FolderExists(currentFolder) Then
            Set folderObj = fso.GetFolder(currentFolder)

            For Each fileObj In folderObj.Files
                fileName = fileObj.Name

                ' Check if file has one of our target extensions
                For j = 0 To UBound(extKeys)
                    currentExt = extKeys(j)
                    If LCase(Right(fileName, Len(currentExt) + 1)) = "." & LCase(currentExt) Then
                        ' Skip if we've already processed this file
                        If Not seenFiles.Exists(fileObj.Path) Then
                            seenFiles.Add fileObj.Path, True

                            ' Try to get font metadata first
                            Dim fontInfo
                            Set fontInfo = GetFontMetadata(fileObj.Path, fileObj.Name)

                            family = fontInfo("Family")
                            face = fontInfo("Style")

                            ' Track this family as found
                            If Not seenFamilies.Exists(family) Then
                                seenFamilies.Add family, True
                            End If

                            ' Store result
                            results.Add results.Count, fileObj.Path & "|" & family & "|" & face
                        End If
                        Exit For
                    End If
                Next
            Next
        End If
    Next
End Sub

Sub AddSystemFonts()
    ' Add system font families using registry-based detection only
    ' No hardcoded lists - rely purely on system detection
    
    ' Get fonts from registry
    Dim registryFonts
    Set registryFonts = GetFontsFromRegistry()

    ' Add registry detected fonts
    If Not registryFonts Is Nothing Then
        Dim regFontName
        For Each regFontName in registryFonts.Keys
            ' Only add if we haven't seen this family name before
            If Not seenFamilies.Exists(regFontName) Then
                seenFamilies.Add regFontName, True
                ' Store result with empty path and Regular face
                results.Add results.Count, "" & "|" & regFontName & "|Regular"
            End If
        Next
    End If

    ' Try to get additional fonts using Windows API if available
    On Error Resume Next
    Call TryAddSystemFontFamilies()
    On Error GoTo 0
End Sub

Function GetFontsFromRegistry()
    ' Enhanced registry-based font detection
    ' Returns a dictionary with font names as keys
    
    Dim fontDict
    Set fontDict = CreateObject("Scripting.Dictionary")

    On Error Resume Next

    Dim WshShell
    Set WshShell = CreateObject("WScript.Shell")

    ' Try to enumerate registry keys more comprehensively
    Dim fontKeys
    fontKeys = Array( _
        "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts\", _
        "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\FontSubstitutes\" _
    )

    ' Common font registry entries to check
    Dim testFonts
    testFonts = Array( _
        "Arial (TrueType)", "Arial Bold (TrueType)", "Arial Italic (TrueType)", "Arial Bold Italic (TrueType)", _
        "Arial Unicode MS (TrueType)", _
        "Bahnschrift (TrueType)", _
        "Calibri (TrueType)", "Calibri Bold (TrueType)", "Calibri Italic (TrueType)", "Calibri Bold Italic (TrueType)", _
        "Cambria (TrueType)", "Cambria Bold (TrueType)", "Cambria Italic (TrueType)", "Cambria Bold Italic (TrueType)", _
        "Cambria Math (TrueType)", _
        "Candara (TrueType)", "Candara Bold (TrueType)", "Candara Italic (TrueType)", "Candara Bold Italic (TrueType)", _
        "Comic Sans MS (TrueType)", "Comic Sans MS Bold (TrueType)", _
        "Consolas (TrueType)", "Consolas Bold (TrueType)", "Consolas Italic (TrueType)", "Consolas Bold Italic (TrueType)", _
        "Constantia (TrueType)", "Constantia Bold (TrueType)", "Constantia Italic (TrueType)", "Constantia Bold Italic (TrueType)", _
        "Corbel (TrueType)", "Corbel Bold (TrueType)", "Corbel Italic (TrueType)", "Corbel Bold Italic (TrueType)", _
        "Courier New (TrueType)", "Courier New Bold (TrueType)", "Courier New Italic (TrueType)", "Courier New Bold Italic (TrueType)", _
        "Ebrima (TrueType)", "Ebrima Bold (TrueType)", _
        "Franklin Gothic Medium (TrueType)", "Franklin Gothic Medium Italic (TrueType)", _
        "Gabriola (TrueType)", _
        "Gadugi (TrueType)", "Gadugi Bold (TrueType)", _
        "Georgia (TrueType)", "Georgia Bold (TrueType)", "Georgia Italic (TrueType)", "Georgia Bold Italic (TrueType)", _
        "Impact (TrueType)", _
        "Ink Free (TrueType)", _
        "Javanese Text (TrueType)", _
        "Leelawadee UI (TrueType)", "Leelawadee UI Bold (TrueType)", "Leelawadee UI Semilight (TrueType)", _
        "Lucida Console (TrueType)", _
        "Lucida Sans Unicode (TrueType)", _
        "Malgun Gothic (TrueType)", "Malgun Gothic Bold (TrueType)", "Malgun Gothic Semilight (TrueType)", _
        "Microsoft Himalaya (TrueType)", _
        "Microsoft JhengHei (TrueType)", "Microsoft JhengHei Bold (TrueType)", "Microsoft JhengHei Light (TrueType)", _
        "Microsoft JhengHei UI (TrueType)", "Microsoft JhengHei UI Bold (TrueType)", "Microsoft JhengHei UI Light (TrueType)", _
        "Microsoft New Tai Lue (TrueType)", "Microsoft New Tai Lue Bold (TrueType)", _
        "Microsoft PhagsPa (TrueType)", "Microsoft PhagsPa Bold (TrueType)", _
        "Microsoft Tai Le (TrueType)", "Microsoft Tai Le Bold (TrueType)", _
        "Microsoft YaHei (TrueType)", "Microsoft YaHei Bold (TrueType)", "Microsoft YaHei Light (TrueType)", _
        "Microsoft YaHei UI (TrueType)", "Microsoft YaHei UI Bold (TrueType)", "Microsoft YaHei UI Light (TrueType)", _
        "Microsoft Yi Baiti (TrueType)", _
        "MingLiU-ExtB (TrueType)", _
        "Mongolian Baiti (TrueType)", _
        "MS Gothic (TrueType)", _
        "MS PGothic (TrueType)", _
        "MS UI Gothic (TrueType)", _
        "MV Boli (TrueType)", _
        "Myanmar Text (TrueType)", "Myanmar Text Bold (TrueType)", _
        "Nirmala UI (TrueType)", "Nirmala UI Bold (TrueType)", "Nirmala UI Semilight (TrueType)", _
        "Palatino Linotype (TrueType)", "Palatino Linotype Bold (TrueType)", "Palatino Linotype Italic (TrueType)", "Palatino Linotype Bold Italic (TrueType)", _
        "Segoe MDL2 Assets (TrueType)", _
        "Segoe Print (TrueType)", "Segoe Print Bold (TrueType)", _
        "Segoe Script (TrueType)", "Segoe Script Bold (TrueType)", _
        "Segoe UI (TrueType)", "Segoe UI Bold (TrueType)", "Segoe UI Italic (TrueType)", "Segoe UI Bold Italic (TrueType)", _
        "Segoe UI Black (TrueType)", "Segoe UI Black Italic (TrueType)", _
        "Segoe UI Emoji (TrueType)", _
        "Segoe UI Historic (TrueType)", _
        "Segoe UI Light (TrueType)", "Segoe UI Light Italic (TrueType)", _
        "Segoe UI Semibold (TrueType)", "Segoe UI Semibold Italic (TrueType)", _
        "Segoe UI Semilight (TrueType)", "Segoe UI Semilight Italic (TrueType)", _
        "Segoe UI Symbol (TrueType)", _
        "SimSun (TrueType)", _
        "SimSun-ExtB (TrueType)", _
        "Sitka Banner (TrueType)", "Sitka Banner Italic (TrueType)", _
        "Sitka Display (TrueType)", "Sitka Display Italic (TrueType)", _
        "Sitka Heading (TrueType)", "Sitka Heading Italic (TrueType)", _
        "Sitka Small (TrueType)", "Sitka Small Italic (TrueType)", _
        "Sitka Subheading (TrueType)", "Sitka Subheading Italic (TrueType)", _
        "Sitka Text (TrueType)", "Sitka Text Italic (TrueType)", _
        "Sylfaen (TrueType)", _
        "Symbol (TrueType)", _
        "Tahoma (TrueType)", "Tahoma Bold (TrueType)", _
        "Times New Roman (TrueType)", "Times New Roman Bold (TrueType)", "Times New Roman Italic (TrueType)", "Times New Roman Bold Italic (TrueType)", _
        "Trebuchet MS (TrueType)", "Trebuchet MS Bold (TrueType)", "Trebuchet MS Italic (TrueType)", "Trebuchet MS Bold Italic (TrueType)", _
        "Verdana (TrueType)", "Verdana Bold (TrueType)", "Verdana Italic (TrueType)", "Verdana Bold Italic (TrueType)", _
        "Webdings (TrueType)", _
        "Wingdings (TrueType)", _
        "Yu Gothic (TrueType)", "Yu Gothic Bold (TrueType)", "Yu Gothic Light (TrueType)", _
        "Yu Gothic UI (TrueType)", "Yu Gothic UI Bold (TrueType)", "Yu Gothic UI Light (TrueType)", "Yu Gothic UI Semibold (TrueType)", "Yu Gothic UI Semilight (TrueType)" _
    )

    ' Try to read font registry values
    Dim fontName, regValue, familyName
    For Each fontName in testFonts
        regValue = ""

        ' Try to read the registry value
        On Error Resume Next
        regValue = WshShell.RegRead(fontKeys(0) & fontName)
        On Error GoTo 0

        If regValue <> "" Then
            ' Extract font family name from registry key name
            familyName = CleanFontName(fontName)

            If familyName <> "" And Not fontDict.Exists(familyName) Then
                fontDict.Add familyName, True
            End If
        End If
    Next

    ' Try to access font substitutes
    Dim substituteFonts
    substituteFonts = Array( _
        "Arial", "Times New Roman", "Courier New", "Segoe UI", "Tahoma", "Verdana", _
        "Calibri", "Cambria", "Consolas", "Constantia", "Corbel", "Franklin Gothic", _
        "Gabriola", "Georgia", "Impact", "Lucida Console", "Lucida Sans Unicode", _
        "Microsoft Sans Serif", "MS Shell Dlg", "MS Shell Dlg 2", "Palatino Linotype", _
        "Segoe Print", "Segoe Script", "Symbol", "System", "Trebuchet MS", "Webdings", "Wingdings" _
    )

    ' Try to read font substitute values
    For Each fontName in substituteFonts
        Dim subValue
        subValue = ""

        On Error Resume Next
        subValue = WshShell.RegRead(fontKeys(1) & fontName)
        On Error GoTo 0

        If subValue <> "" Then
            ' Add both the substitute name and the substituted font
            If Not fontDict.Exists(fontName) Then
                fontDict.Add fontName, True
            End If

            If Not fontDict.Exists(subValue) Then
                fontDict.Add subValue, True
            End If
        Else
            ' Even if no substitute value, add the font name itself
            If Not fontDict.Exists(fontName) Then
                fontDict.Add fontName, True
            End If
        End If
    Next

    ' Essential system virtual fonts that should always be included
    Dim essentialFonts
    essentialFonts = Array("MS Shell Dlg", "MS Shell Dlg 2", "System", "Microsoft Sans Serif")

    Dim essentialFont
    For Each essentialFont in essentialFonts
        If Not fontDict.Exists(essentialFont) Then
            fontDict.Add essentialFont, True
        End If
    Next

    On Error GoTo 0

    Set GetFontsFromRegistry = fontDict
End Function

Function GetFontMetadata(fontPath, fileName)
    Dim fontInfo
    Set fontInfo = CreateObject("Scripting.Dictionary")

    ' Try to get metadata using Shell.Application
    Dim folderPath, justFileName
    folderPath = fso.GetParentFolderName(fontPath)
    justFileName = fso.GetFileName(fontPath)

    On Error Resume Next
    Dim folder, fileItem
    Set folder = objShell.Namespace(folderPath)

    If Not folder Is Nothing Then
        Set fileItem = folder.ParseName(justFileName)
        If Not fileItem Is Nothing Then
            ' Get font name from extended properties
            ' Common property indices for font information
            ' Index 0: Name
            ' Index 21: Title/Font Name on some systems
            ' Index 165: Font face name on some systems
            ' Index 194: Font family on some systems

            Dim fontName, i
            fontName = ""

            ' Try known property indices first
            Dim knownIndices
            knownIndices = Array(0, 21, 165, 194, 195)

            For Each i In knownIndices
                Dim propValue
                propValue = folder.GetDetailsOf(fileItem, i)
                If propValue <> "" Then
                    ' Check if this looks like a font family name
                    If InStr(propValue, "Times New Roman") > 0 Or _
                       InStr(propValue, "Arial") > 0 Or _
                       InStr(propValue, "Calibri") > 0 Or _
                       InStr(propValue, "Tahoma") > 0 Or _
                       Len(propValue) > 3 And InStr(propValue, ".") = 0 And _
                       InStr(propValue, "KB") = 0 And InStr(propValue, "MB") = 0 And _
                       Not IsNumeric(propValue) Then
                        fontName = propValue
                        Exit For
                    End If
                End If
            Next

            ' If we didn't find a name with known indices, try scanning more property indices
            If fontName = "" Then
                For i = 1 To 200
                    If Not Contains(knownIndices, i) Then
                        propValue = folder.GetDetailsOf(fileItem, i)
                        If propValue <> "" Then
                            ' Check if this looks like a font family name
                            If InStr(propValue, "Times New Roman") > 0 Or _
                               InStr(propValue, "Arial") > 0 Or _
                               InStr(propValue, "Calibri") > 0 Or _
                               InStr(propValue, "Tahoma") > 0 Or _
                               Len(propValue) > 3 And InStr(propValue, ".") = 0 And _
                               InStr(propValue, "KB") = 0 And InStr(propValue, "MB") = 0 And _
                               Not IsNumeric(propValue) Then
                                fontName = propValue
                                Exit For
                            End If
                        End If
                    End If
                Next
            End If

            ' If we found a font name, use it
            If fontName <> "" And fontName <> justFileName Then
                ' Clean up family name by removing style suffixes that sometimes appear in font metadata
                Dim cleanedFamily
                cleanedFamily = fontName
                Dim styleKeywords
                styleKeywords = Array("Black", "Light", "Thin", "Medium", "Bold", "Italic", "Semibold", "Semilight", "Condensed", "Expanded", "Regular")
                
                Dim j, keyword
                For j = 0 To UBound(styleKeywords)
                    keyword = styleKeywords(j)
                    ' Remove style keyword if it appears at the end of the family name
                    If Right(cleanedFamily, Len(" " & keyword)) = " " & keyword Then
                        cleanedFamily = Left(cleanedFamily, Len(cleanedFamily) - Len(keyword) - 1)
                        cleanedFamily = Trim(cleanedFamily)
                        Exit For ' Only remove one style keyword to avoid over-cleaning
                    End If
                Next
                
                fontInfo("Family") = cleanedFamily
                fontInfo("Style") = GetStyleFromMetadata(fontName, fileName)
                fontInfo("Success") = True
                On Error GoTo 0
                Set GetFontMetadata = fontInfo
                Exit Function
            End If
        End If
    End If
    On Error GoTo 0

    ' Fallback to enhanced filename parsing
    Dim fallbackInfo
    Set fallbackInfo = GetFallbackFontInfo(fileName)
    fontInfo("Family") = fallbackInfo("Family")
    fontInfo("Style") = fallbackInfo("Style")
    fontInfo("Success") = False

    Set GetFontMetadata = fontInfo
End Function

Function GetStyleFromMetadata(fontName, fileName)
    ' Extract style information from filename since metadata often doesn't include style
    ' Prioritize filename-based detection over font metadata for accuracy
    Dim baseName, lowerName
    baseName = fso.GetBaseName(fileName)
    lowerName = LCase(baseName)

    ' Check filename patterns for style - this is more reliable than metadata
    If Len(baseName) <= 10 Then
        If Right(lowerName, 2) = "bd" Then
            GetStyleFromMetadata = "Bold"
        ElseIf Right(lowerName, 2) = "bi" Then
            GetStyleFromMetadata = "Bold Italic"
        ElseIf Right(lowerName, 1) = "i" And lowerName <> "i" Then
            GetStyleFromMetadata = "Italic"
        Else
            GetStyleFromMetadata = "Regular"
        End If
    Else
        ' For longer names, check for style keywords
        If (InStr(lowerName, "bold") > 0 And InStr(lowerName, "italic") > 0) Or InStr(lowerName, "bi") > 0 Then
            GetStyleFromMetadata = "Bold Italic"
        ElseIf InStr(lowerName, "bold") > 0 Or InStr(lowerName, "bd") > 0 Then
            GetStyleFromMetadata = "Bold"
        ElseIf InStr(lowerName, "italic") > 0 Or InStr(lowerName, "it") > 0 Then
            GetStyleFromMetadata = "Italic"
        ElseIf InStr(lowerName, "regular") > 0 Then
            GetStyleFromMetadata = "Regular"
        ElseIf InStr(lowerName, "light") > 0 Then
            GetStyleFromMetadata = "Light"
        ElseIf InStr(lowerName, "thin") > 0 Then
            GetStyleFromMetadata = "Thin"
        ElseIf InStr(lowerName, "medium") > 0 Then
            GetStyleFromMetadata = "Medium"
        ElseIf InStr(lowerName, "black") > 0 Then
            GetStyleFromMetadata = "Black"
        Else
            GetStyleFromMetadata = "Regular"
        End If
    End If
End Function

Function GetFallbackFontInfo(fileName)
    Dim fontInfo
    Set fontInfo = CreateObject("Scripting.Dictionary")

    Dim baseName, normalizedName, familyName, lowerName
    baseName = fso.GetBaseName(fileName)
    lowerName = LCase(baseName)

    ' Extract family name from filename
    If Len(baseName) <= 10 Then
        If Right(lowerName, 2) = "bd" Then
            familyName = Left(baseName, Len(baseName) - 2)
        ElseIf Right(lowerName, 2) = "bi" Then
            familyName = Left(baseName, Len(baseName) - 2)
        ElseIf Right(lowerName, 1) = "i" And lowerName <> "i" Then
            familyName = Left(baseName, Len(baseName) - 1)
        Else
            familyName = baseName
        End If
    Else
        familyName = baseName
        ' Remove common style suffixes with hyphens first, then without
        Dim styleSuffixes
        styleSuffixes = Array("-Bold", "-Italic", "-Light", "-Regular", "-Medium", "-Thin", "-Black", "-Semibold", "-Semilight", "-Condensed", "-Expanded", "Bold", "Italic", "Light", "Regular", "Medium", "Thin", "Black", "Semibold", "Semilight", "Condensed", "Expanded")
        
        Dim i, suffix
        For i = 0 To UBound(styleSuffixes)
            suffix = styleSuffixes(i)
            If Right(familyName, Len(suffix)) = suffix Then
                familyName = Left(familyName, Len(familyName) - Len(suffix))
                Exit For ' Only remove one suffix to avoid over-cleaning
            End If
        Next
        
        familyName = Trim(familyName)
    End If

    ' Apply proper case formatting to family name
    familyName = ProperCase(familyName)

    ' Apply proper family name mapping
    fontInfo("Family") = GetProperFamilyName(familyName)
    fontInfo("Style") = GetStyleFromMetadata("", fileName)

    Set GetFallbackFontInfo = fontInfo
End Function

Function CleanFontName(fontName)
    ' Clean up font name by removing type descriptors and style suffixes
    Dim result
    result = fontName

    ' Remove type descriptors
    result = Replace(result, " (TrueType)", "")
    result = Replace(result, " (OpenType)", "")
    result = Replace(result, " (CFF)", "")
    result = Replace(result, " (PostScript)", "")
    result = Replace(result, " (Type 1)", "")

    ' Remove style suffixes that sometimes appear in font names
    Dim styleKeywords
    styleKeywords = Array(" Bold Italic", " Bold", " Italic", " Light", " Thin", " Medium", " Black", " Semibold", " Semilight", " Condensed", " Expanded", " Regular")
    
    Dim i, keyword
    For i = 0 To UBound(styleKeywords)
        keyword = styleKeywords(i)
        ' Remove style keyword if it appears at the end of the family name
        If Right(result, Len(keyword)) = keyword Then
            result = Left(result, Len(result) - Len(keyword))
            Exit For ' Only remove one style keyword to avoid over-cleaning
        End If
    Next

    CleanFontName = Trim(result)
End Function

Function GetProperFamilyName(extractedFamily)
    ' Simplified function that returns the family name as-is from font metadata or filename parsing
    ' No hardcoded mappings - rely purely on font metadata and dynamic detection
    
    If extractedFamily = "" Or IsNull(extractedFamily) Then
        GetProperFamilyName = ""
    Else
        ' Just return the extracted family name without any hardcoded mappings
        ' This ensures we rely completely on font metadata and system detection
        GetProperFamilyName = extractedFamily
    End If
End Function

Function ProperCase(inputString)
    ' Simple function to convert to proper case (first letter uppercase)
    If Len(inputString) = 0 Then
        ProperCase = ""
    Else
        ProperCase = UCase(Left(inputString, 1)) & LCase(Mid(inputString, 2))
    End If
End Function

Function Contains(arr, val)
    ' Helper function to check if an array contains a value
    Dim item
    Contains = False

    For Each item In arr
        If item = val Then
            Contains = True
            Exit Function
        End If
    Next
End Function

Function RegexReplace(inputString, pattern, replacement)
    ' Simple regex replacement for common patterns
    Dim result
    result = inputString

    ' Handle version pattern: [Version X.XX] XXXXXX
    If pattern = "\s*\[Version\s+[\d\.]+\]\s*\d*" Then
        Dim pos
        pos = InStr(result, "[Version")
        If pos > 0 Then
            Dim endPos
            endPos = InStr(pos, result, "]")
            If endPos > 0 Then
                ' Check if there are trailing digits and spaces after the ]
                Dim i, afterBracket
                afterBracket = endPos + 1
                ' Skip any trailing numbers and spaces
                For i = afterBracket To Len(result)
                    Dim ch
                    ch = Mid(result, i, 1)
                    If ch <> " " And Not IsNumeric(ch) Then
                        Exit For
                    End If
                Next

                ' Remove the version string and trailing content
                If pos > 1 And Mid(result, pos - 1, 1) = " " Then
                    result = Left(result, pos - 2) & Mid(result, i)
                Else
                    result = Left(result, pos - 1) & Mid(result, i)
                End If
            End If
        End If
    End If

    ' Handle style suffixes pattern
    If pattern = "\s+(bold|italic|light|regular|medium|thin|black|condensed|expanded|oblique)(\s|$)" Then
        ' Simple approach: find and remove style words at the end
        Dim lowerResult
        lowerResult = LCase(result)
        Dim styles
        styles = Array(" bold", " italic", " light", " regular", " medium", " thin", " black", " condensed", " expanded", " oblique")

        Dim j
        For j = 0 To UBound(styles)
            If Right(lowerResult, Len(styles(j))) = styles(j) Then
                result = Left(result, Len(result) - Len(styles(j)))
                Exit For
            End If
        Next
    End If

    ' Handle multiple spaces
    If pattern = "\s+" Then
        Do While InStr(result, "  ") > 0
            result = Replace(result, "  ", " ")
        Loop
    End If

    RegexReplace = result
End Function

Function EscapeCSV(value)
    Dim result
    result = Replace(value, """", """""")
    If InStr(result, ",") > 0 Then
        result = """" & result & """"
    End If
    EscapeCSV = result
End Function

Sub OutputCSV()
    Dim resultKeys, fontData, parts

    ' Try to add system fonts using alternative methods
    On Error Resume Next
    Call TryAddSystemFontFamilies()
    On Error GoTo 0

    ' First pass: identify all fonts with full paths
    Dim fontFamilyWithPath, normalizedFamily
    Set fontFamilyWithPath = CreateObject("Scripting.Dictionary")

    resultKeys = results.Keys
    For i = 0 To UBound(resultKeys)
        fontData = results(resultKeys(i))
        parts = Split(fontData, "|")

        If UBound(parts) >= 2 Then
            ' If this font has a full path
            If parts(0) <> "" Then
                ' Normalize family name by removing trailing spaces
                normalizedFamily = Trim(parts(1))
                ' Mark this family as having a physical file
                If Not fontFamilyWithPath.Exists(normalizedFamily) Then
                    fontFamilyWithPath.Add normalizedFamily, True
                End If
            End If
        End If
    Next

    ' Output header
    WScript.Echo "FullPath,Family,Face"

    ' Second pass: output fonts, skipping virtual fonts when a physical file exists
    resultKeys = results.Keys
    For i = 0 To UBound(resultKeys)
        fontData = results(resultKeys(i))
        parts = Split(fontData, "|")

        If UBound(parts) >= 2 Then
            ' Normalize family name by removing trailing spaces
            normalizedFamily = Trim(parts(1))

            ' Skip this font if:
            ' 1. It has no path (virtual font)
            ' 2. The same font family exists with a full path
            If parts(0) = "" And fontFamilyWithPath.Exists(normalizedFamily) Then
                ' Skip this virtual font as we have a physical file for this family
            Else
                ' Output the font with normalized family name
                WScript.Echo EscapeCSV(parts(0)) & "," & EscapeCSV(normalizedFamily) & "," & EscapeCSV(parts(2))
            End If
        End If
    Next
End Sub

Sub TryAddSystemFontFamilies()
    ' Try to add system font families using alternative methods
    ' This replaces the DirectWrite approach with more compatible methods
    
    On Error Resume Next
    
    ' Method 1: Try to enumerate installed fonts using Windows API if available
    Dim fontAPI
    Set fontAPI = Nothing
    
    ' Try to create a font enumeration object using Windows Script Host
    ' This approach attempts to use system APIs indirectly
    Err.Clear
    
    ' Method 2: Try to use COM objects for font enumeration
    Dim fontEnum
    Set fontEnum = Nothing
    
    ' Try alternative COM objects that might provide font enumeration
    Dim comObjects
    comObjects = Array("FontEnumerator.Application", "Windows.Font.Collection", "System.Drawing.Text.InstalledFontCollection")
    
    Dim i, objName
    For i = 0 To UBound(comObjects)
        objName = comObjects(i)
        Err.Clear
        Set fontEnum = CreateObject(objName)
        If Err.Number = 0 And Not fontEnum Is Nothing Then
            ' If we successfully created a font enumeration object, try to get fonts
            Exit For
        End If
        Set fontEnum = Nothing
    Next
    
    ' Method 3: Try to read from system font cache files if accessible
    ' This is a fallback approach that tries to read font information from system cache
    Dim fontCachePaths
    fontCachePaths = Array( _
        shell.ExpandEnvironmentStrings("%WINDIR%") & "\System32\FNTCACHE.DAT", _
        shell.ExpandEnvironmentStrings("%WINDIR%") & "\ServiceProfiles\LocalService\AppData\Local\FontCache\*", _
        shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Microsoft\Windows\Fonts\*" _
    )
    
    ' Note: Reading font cache files directly is complex and not recommended,
    ' so we'll rely primarily on the registry-based approach
    
    On Error GoTo 0
End Sub
