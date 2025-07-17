# PowerShell script to list all available fonts and output as CSV
# Enhanced version with maximum compatibility for all PowerShell versions (including PS 1.0/2.0/3.0)
# Optimized for maximum compatibility across all PowerShell versions
# Uses only basic language features and avoids modern cmdlets/operators
#
# Enhanced compatibility features for older PowerShell versions:
# - Uses hashtable literals (@{}) instead of New-Object Hashtable for PS 2.0+
# - Uses .Contains() and .Replace() instead of -match and -replace for better compatibility
# - Uses LoadWithPartialName for assembly loading fallback for older .NET versions
# - Uses custom Test-StringEmpty function instead of [string]::IsNullOrEmpty for PS 1.0 compatibility
# - Enhanced error handling for older .NET Framework versions (1.1, 2.0, 3.5)
# - Uses more conservative string and collection operations for PS 1.0/2.0
# - Avoids advanced PowerShell features that were introduced in PS 3.0+
#
# Usage examples:
#   .\find-font-files.ps1
#   .\find-font-files.ps1 -IncludeUserFonts
#   .\find-font-files.ps1 -IncludeSystemFonts

param(
    [string[]]$FontFolders = @(),
    [string[]]$FileExtensions = @('*.ttf', '*.otf', '*.ttc', '*.woff', '*.woff2', '*.fon', '*.fnt'),
    [switch]$IncludeSystemFonts,
    [switch]$IncludeUserFonts
)

# Build font folders list if not specified
if ($FontFolders.Count -eq 0) {
    # Use ArrayList for better compatibility with older PowerShell versions
    $defaultFolders = New-Object System.Collections.ArrayList

    if ($IncludeSystemFonts -or (-not $IncludeSystemFonts -and -not $IncludeUserFonts)) {
        $systemFontFolder = "C:\Windows\Fonts"
        if (Test-Path $systemFontFolder) { [void]$defaultFolders.Add($systemFontFolder) }
    }
    if ($IncludeUserFonts -or (-not $IncludeSystemFonts -and -not $IncludeUserFonts)) {
        $userLocalFonts = "$env:LOCALAPPDATA\Microsoft\Windows\Fonts"
        if (Test-Path $userLocalFonts) { [void]$defaultFolders.Add($userLocalFonts) }

        $userRoamingFonts = "$env:APPDATA\Microsoft\Windows\Fonts"
        if (Test-Path $userRoamingFonts) { [void]$defaultFolders.Add($userRoamingFonts) }

        $adobeFonts = "$env:LOCALAPPDATA\Adobe\CoreSync\plugins\livetype\r"
        if (Test-Path $adobeFonts) { [void]$defaultFolders.Add($adobeFonts) }

        $officeFonts = "$env:PROGRAMFILES\Microsoft Office\root\VFS\Fonts\private"
        if (Test-Path $officeFonts) { [void]$defaultFolders.Add($officeFonts) }

        $commonLocations = @(
            "$env:PROGRAMFILES\Common Files\Microsoft Shared\Fonts",
            "$env:PROGRAMFILES(X86)\Common Files\Microsoft Shared\Fonts",
            "$env:USERPROFILE\AppData\Local\Microsoft\Windows\Fonts",
            "$env:USERPROFILE\Documents\My Fonts"
        )
        foreach ($location in $commonLocations) {
            if (Test-Path $location) { [void]$defaultFolders.Add($location) }
        }
    }
    # Convert ArrayList back to array for assignment
    $FontFolders = $defaultFolders.ToArray()
}

# Load required assemblies for font metadata reading with enhanced compatibility for all PS versions
$assembliesLoaded = $false
try {
    # First try the modern approach (PS 2.0+)
    Add-Type -AssemblyName System.Drawing -ErrorAction Stop
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    $assembliesLoaded = $true
}
catch {
    # Fallback for older PowerShell versions or missing assemblies
    try {
        # Try LoadWithPartialName approach for very old PS versions
        [void][System.Reflection.Assembly]::LoadWithPartialName("System.Drawing")
        [void][System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms")
        $assembliesLoaded = $true
    }
    catch {
        # Final fallback - try direct assembly loading for PS 1.0
        try {
            [void][System.Reflection.Assembly]::LoadFrom("$env:WINDIR\Microsoft.NET\Framework\v2.0.50727\System.Drawing.dll")
            [void][System.Reflection.Assembly]::LoadFrom("$env:WINDIR\Microsoft.NET\Framework\v2.0.50727\System.Windows.Forms.dll")
            $assembliesLoaded = $true
        }
        catch {
            Write-Warning "Failed to load System.Drawing assemblies: $($_.Exception.Message)"
            Write-Warning "Font metadata features will not be available - falling back to filename parsing only"
            $assembliesLoaded = $false
        }
    }
}

# Helper function for all PowerShell version compatibility
function Test-StringEmpty {
    param([string]$InputString)
    # More conservative approach for PS 1.0/2.0 compatibility
    if ($InputString -eq $null) { return $true }
    if ($InputString -eq "") { return $true }
    if ($InputString.Length -eq 0) { return $true }
    
    # Try trim operation safely for older PS versions
    try {
        if ($InputString.Trim() -eq "") { return $true }
    }
    catch {
        # If trim fails, just check the original string
        return $false
    }
    
    return $false
}

# Helper function for safe string operations in older PowerShell versions
function Test-StringContains {
    param([string]$InputString, [string]$SearchString)
    
    if (Test-StringEmpty $InputString) { return $false }
    if (Test-StringEmpty $SearchString) { return $false }
    
    # Use IndexOf for maximum compatibility instead of Contains (PS 1.0/2.0 safe)
    try {
        return ($InputString.IndexOf($SearchString) -ge 0)
    }
    catch {
        # Fallback for very old versions
        return ($InputString -like "*$SearchString*")
    }
}

# Helper function for safe string replacement in older PowerShell versions
function Invoke-StringReplace {
    param([string]$InputString, [string]$OldValue, [string]$NewValue)
    
    if (Test-StringEmpty $InputString) { return "" }
    if (Test-StringEmpty $OldValue) { return $InputString }
    if ($NewValue -eq $null) { $NewValue = "" }
    
    # Use Replace method for maximum compatibility
    try {
        return $InputString.Replace($OldValue, $NewValue)
    }
    catch {
        # Fallback for very old versions
        return $InputString
    }
}

# Helper functions
function Get-FontMetadata {
    param([string]$FontPath)

    # Check if assemblies are loaded before attempting metadata reading
    if (-not $assembliesLoaded) {
        return @{
            Family  = $null
            Style   = $null
            Success = $false
            Error   = "System.Drawing assemblies not available"
        }
    }

    try {
        # Create a PrivateFontCollection to load the font file
        $fontCollection = New-Object System.Drawing.Text.PrivateFontCollection
        $fontCollection.AddFontFile($FontPath)

        if ($fontCollection.Families.Count -gt 0) {
            $fontFamily = $fontCollection.Families[0]
            $familyName = $fontFamily.Name

            # Try to determine style by checking available styles
            $styleName = "Regular"

            # Check which styles are available for this font family - with error handling for PS 2.0
            try {
                $isBold = $fontFamily.IsStyleAvailable([System.Drawing.FontStyle]::Bold)
                $isItalic = $fontFamily.IsStyleAvailable([System.Drawing.FontStyle]::Italic)
                $isBoldItalic = $fontFamily.IsStyleAvailable([System.Drawing.FontStyle]::Bold -bor [System.Drawing.FontStyle]::Italic)
                $isRegular = $fontFamily.IsStyleAvailable([System.Drawing.FontStyle]::Regular)
            }
            catch {
                # If style checking fails, continue with filename-based detection
                $isBold = $false
                $isItalic = $false
                $isBoldItalic = $false
                $isRegular = $true
            }

            # Also check filename for style hints - this helps override incorrect font metadata
            $baseName = [System.IO.Path]::GetFileNameWithoutExtension($FontPath).ToLower()

            # First check filename patterns for style - this is more reliable for many fonts
            $fileStyleName = "Regular"
            
            # Use safer string operations for older PowerShell versions
            if ($baseName.Length -ge 2 -and $baseName.Substring($baseName.Length - 2) -eq "bd") {
                if ($baseName.Length -ge 2 -and $baseName.Substring($baseName.Length - 2) -eq "bi") {
                    $fileStyleName = "Bold Italic"
                }
                elseif (Test-StringContains $baseName "italic") {
                    $fileStyleName = "Bold Italic"
                }
                else {
                    $fileStyleName = "Bold"
                }
            }
            elseif ($baseName.Length -ge 2 -and $baseName.Substring($baseName.Length - 2) -eq "bi") {
                $fileStyleName = "Bold Italic"
            }
            elseif ((Test-StringContains $baseName "bold") -and (Test-StringContains $baseName "italic")) {
                $fileStyleName = "Bold Italic"
            }
            elseif ($baseName.Length -ge 1 -and $baseName.Substring($baseName.Length - 1) -eq "i" -and $baseName -ne "i") {
                $fileStyleName = "Italic"
            }
            elseif (Test-StringContains $baseName "italic") {
                $fileStyleName = "Italic"
            }
            elseif (Test-StringContains $baseName "regular") {
                $fileStyleName = "Regular"
            }
            elseif (Test-StringContains $baseName "light") {
                $fileStyleName = "Light"
            }
            elseif (Test-StringContains $baseName "thin") {
                $fileStyleName = "Thin"
            }
            elseif (Test-StringContains $baseName "medium") {
                $fileStyleName = "Medium"
            }
            elseif (Test-StringContains $baseName "black") {
                $fileStyleName = "Black"
            }
            elseif (Test-StringContains $baseName "semibold") {
                $fileStyleName = "Semibold"
            }
            elseif (Test-StringContains $baseName "semilight") {
                $fileStyleName = "Semilight"
            }
            elseif (Test-StringContains $baseName "condensed") {
                $fileStyleName = "Condensed"
            }
            elseif (Test-StringContains $baseName "expanded") {
                $fileStyleName = "Expanded"
            }

            # Use filename-based style detection, prioritizing filename over font metadata
            # This is more reliable for many fonts where metadata is incorrect
            if ($fileStyleName -ne "Regular") {
                $styleName = $fileStyleName
            }
            else {
                # For files marked as "Regular" by filename, force the style to be Regular
                # Don't trust font metadata that says otherwise
                $styleName = "Regular"
            }

            # Map family names for consistency with VBScript version
            $mappedFamily = Get-ProperFamilyName $familyName

            # Clean up family name by removing style suffixes that sometimes appear in font metadata
            $cleanedFamily = $mappedFamily
            $styleKeywords = @("Black", "Light", "Thin", "Medium", "Bold", "Italic", "Semibold", "Semilight", "Condensed", "Expanded", "Regular")
            foreach ($keyword in $styleKeywords) {
                # Remove style keyword if it appears at the end of the family name
                if ($cleanedFamily.EndsWith(" $keyword")) {
                    $cleanedFamily = $cleanedFamily.Substring(0, $cleanedFamily.Length - $keyword.Length - 1).Trim()
                    break  # Only remove one style keyword to avoid over-cleaning
                }
            }

            return @{
                Family  = $cleanedFamily
                Style   = $styleName
                Success = $true
            }
        }

        # Dispose of the font collection safely
        try {
            $fontCollection.Dispose()
        }
        catch {
            # Ignore disposal errors in older PowerShell versions
        }
    }
    catch {
        # If font metadata reading fails, fall back to filename parsing
        return @{
            Family  = $null
            Style   = $null
            Success = $false
            Error   = $_.Exception.Message
        }
    }

    return @{
        Family  = $null
        Style   = $null
        Success = $false
    }
}

function Get-FallbackFontInfo {
    param([string]$FileName)
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($FileName)
    $lowerName = $baseName.ToLower()

    # Fallback family name extraction
    $familyName = $baseName
    if ($baseName.Length -le 10) {
        if ($lowerName.EndsWith("bd")) {
            $familyName = $baseName.Substring(0, $baseName.Length - 2)
        }
        elseif ($lowerName.EndsWith("bi")) {
            $familyName = $baseName.Substring(0, $baseName.Length - 2)
        }
        elseif ($lowerName.EndsWith("i") -and $lowerName -ne "i") {
            $familyName = $baseName.Substring(0, $baseName.Length - 1)
        }
    }
    else {
        # For longer names, remove common style indicators
        # Using a more compatibility-friendly approach with explicit checks for older PS versions
        $commonStyles = @("-Bold", "-Italic", "-Light", "-Regular", "-Medium", "-Thin",
            "-Black", "-Semibold", "-Semilight", "-Condensed", "-Expanded",
            "Bold", "Italic", "Light", "Regular", "Medium", "Thin",
            "Black", "Semibold", "Semilight", "Condensed", "Expanded")

        foreach ($style in $commonStyles) {
            # Use safer string operations for older PowerShell versions
            if ($familyName.Length -ge $style.Length) {
                $endPortion = $familyName.Substring($familyName.Length - $style.Length)
                if ($endPortion -eq $style) {
                    $familyName = $familyName.Substring(0, $familyName.Length - $style.Length)
                    try {
                        $familyName = $familyName.Trim()
                    }
                    catch {
                        # If trim fails in old PS versions, just continue
                    }
                    break  # Only remove one style to avoid over-cleaning
                }
            }
        }

        try {
            $familyName = $familyName.Trim()
        }
        catch {
            # If trim fails in older PowerShell versions, continue without trimming
        }
    }

    # Apply proper family name mapping for consistency
    $mappedFamily = Get-ProperFamilyName $familyName

    # Fallback style determination
    $styleName = "Regular"
    if ($baseName.Length -le 10) {
        if ($lowerName.EndsWith("bd")) { $styleName = 'Bold' }
        elseif ($lowerName.EndsWith("bi")) { $styleName = 'Bold Italic' }
        elseif ($lowerName.EndsWith("i") -and $lowerName -ne "i") { $styleName = 'Italic' }
    }
    else {
        # For longer names, check for style keywords using safer string operations
        if ((Test-StringContains $lowerName "bold") -and (Test-StringContains $lowerName "italic")) {
            $styleName = "Bold Italic"
        }
        elseif (Test-StringContains $lowerName "bi") {
            $styleName = "Bold Italic"
        }
        elseif (Test-StringContains $lowerName "bold") {
            $styleName = "Bold"
        }
        elseif (Test-StringContains $lowerName "bd") {
            $styleName = "Bold"
        }
        elseif (Test-StringContains $lowerName "italic") {
            $styleName = "Italic"
        }
        elseif (Test-StringContains $lowerName "it") {
            $styleName = "Italic"
        }
        elseif (Test-StringContains $lowerName "regular") {
            $styleName = "Regular"
        }
        elseif (Test-StringContains $lowerName "light") {
            $styleName = "Light"
        }
        elseif (Test-StringContains $lowerName "thin") {
            $styleName = "Thin"
        }
        elseif (Test-StringContains $lowerName "medium") {
            $styleName = "Medium"
        }
        elseif (Test-StringContains $lowerName "black") {
            $styleName = "Black"
        }
        elseif (Test-StringContains $lowerName "semibold") {
            $styleName = "Semibold"
        }
        elseif (Test-StringContains $lowerName "semilight") {
            $styleName = "Semilight"
        }
    }

    return @{
        Family = $mappedFamily
        Style  = $styleName
    }
}

function Get-FontsFromRegistry {
    # Attempt to get font information from registry as an additional source
    # Returns a hashtable with font names as keys
    try {
        $fontDict = @{}

        # Check font registry paths
        $fontKeys = @(
            'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts',
            'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\FontSubstitutes'
        )

        foreach ($keyPath in $fontKeys) {
            if (Test-Path $keyPath) {
                $fontKey = Get-Item -Path $keyPath

                # Process font registry values
                foreach ($valueName in $fontKey.GetValueNames()) {
                    # Extract font family name
                    $familyName = $valueName

                    # Clean up font family name - using more compatible string operations for older PS versions
                    if (Test-StringContains $familyName " (TrueType)") {
                        $familyName = Invoke-StringReplace $familyName " (TrueType)" ""
                    }
                    if (Test-StringContains $familyName " (OpenType)") {
                        $familyName = Invoke-StringReplace $familyName " (OpenType)" ""
                    }
                    if (Test-StringContains $familyName " (CFF)") {
                        $familyName = Invoke-StringReplace $familyName " (CFF)" ""
                    }
                    if (Test-StringContains $familyName " Regular") {
                        # Only remove if it's at the end
                        if ($familyName.Length -ge 8 -and $familyName.Substring($familyName.Length - 8) -eq " Regular") {
                            $familyName = $familyName.Substring(0, $familyName.Length - 8)
                        }
                    }
                    try {
                        $familyName = $familyName.Trim()
                    }
                    catch {
                        # If trim fails in older PowerShell versions, continue
                    }

                    # Add to dictionary if not empty
                    if ($familyName -and -not $fontDict.ContainsKey($familyName)) {
                        $fontDict[$familyName] = $true
                    }

                    # For font substitutes, also add the substituted font
                    if ($keyPath -like '*FontSubstitutes') {
                        $substituteValue = $fontKey.GetValue($valueName)
                        if ($substituteValue -and -not $fontDict.ContainsKey($substituteValue)) {
                            $fontDict[$substituteValue] = $true
                        }
                    }
                }
            }
        }

        # Try to directly read MS Shell Dlg mappings - these are important system virtual fonts
        try {
            $shellDlgKey = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\FontSubstitutes'
            if (Test-Path $shellDlgKey) {
                $shellDlgFonts = @('MS Shell Dlg', 'MS Shell Dlg 2')
                foreach ($shellFont in $shellDlgFonts) {
                    $shellValue = (Get-ItemProperty -Path $shellDlgKey -Name $shellFont -ErrorAction SilentlyContinue).$shellFont
                    if ($shellValue) {
                        if (-not $fontDict.ContainsKey($shellFont)) {
                            $fontDict[$shellFont] = $true
                        }
                        if (-not $fontDict.ContainsKey($shellValue)) {
                            $fontDict[$shellValue] = $true
                        }
                    }
                }
            }
        }
        catch {
            # Continue even if this specific check fails
            Write-Verbose "Could not check MS Shell Dlg mappings: $($_.Exception.Message)"
        }

        # Keep only essential system virtual fonts that can't be detected otherwise
        $essentialFonts = @(
            'MS Shell Dlg',
            'MS Shell Dlg 2'
        )

        foreach ($font in $essentialFonts) {
            if (-not $fontDict.ContainsKey($font)) {
                $fontDict[$font] = $true
            }
        }

        return $fontDict
    }
    catch {
        Write-Warning "Error retrieving fonts from registry: $($_.Exception.Message)"
        return @{}
    }
}



function Get-ProperFamilyName {
    param([string]$ExtractedFamily)

    # Simplified function that returns the family name as-is from font metadata or filename parsing
    # No hardcoded mappings - rely purely on font metadata and dynamic detection
    # Enhanced for PS 2.0 compatibility

    if (Test-StringEmpty $ExtractedFamily) {
        return ""
    }

    # Just return the extracted family name without any hardcoded mappings
    # This ensures we rely completely on font metadata and system detection
    return $ExtractedFamily
}

# Scan for all font files
# Enhanced for maximum PowerShell version compatibility
$results = New-Object System.Collections.ArrayList
$seenFiles = @{}  # Use hashtable literal for PS 2.0 compatibility
$seenFamilies = @{}  # Use hashtable literal for PS 2.0 compatibility

foreach ($fontFolder in $FontFolders) {
    foreach ($ext in $FileExtensions) {
        $files = Get-ChildItem -Path $fontFolder -Filter $ext -ErrorAction SilentlyContinue
        foreach ($file in $files) {
            # Skip if we've already processed this exact file path
            if ($seenFiles.ContainsKey($file.FullName)) {
                continue
            }
            $seenFiles[$file.FullName] = $true

            # Try to get font metadata first
            $fontInfo = Get-FontMetadata -FontPath $file.FullName

            if ($fontInfo.Success) {
                $family = $fontInfo.Family
                $face = $fontInfo.Style
            }
            else {
                # Fall back to filename parsing if metadata reading fails
                $fallbackInfo = Get-FallbackFontInfo -FileName $file.Name
                $family = $fallbackInfo.Family
                $face = $fallbackInfo.Style
            }

            # Track this family as found
            $seenFamilies[$family] = $true

            # Create object compatible with older PowerShell versions
            $fontObject = New-Object PSObject
            $fontObject | Add-Member -MemberType NoteProperty -Name "FullPath" -Value $file.FullName
            $fontObject | Add-Member -MemberType NoteProperty -Name "Family" -Value $family
            $fontObject | Add-Member -MemberType NoteProperty -Name "Face" -Value $face

            # Using ArrayList's Add method instead of += for better performance and compatibility
            [void]$results.Add($fontObject)
        }
    }
}

# Add system font families that weren't found in file scan
# Enhanced compatibility for all PowerShell versions
try {
    # First try to load WPF assembly with better error handling
    $wpfAssemblyLoaded = $false

    try {
        # Check if WPF is available by attempting to load required assemblies
        # Use more defensive approach for older PowerShell versions
        try {
            # Try modern approach first
            [void][System.Reflection.Assembly]::LoadWithPartialName("PresentationFramework")
            [void][System.Reflection.Assembly]::LoadWithPartialName("PresentationCore")
        }
        catch {
            # Fallback for very old PowerShell versions
            try {
                [void][System.Reflection.Assembly]::LoadFrom("$env:WINDIR\Microsoft.NET\Framework\v3.0\WPF\PresentationFramework.dll")
                [void][System.Reflection.Assembly]::LoadFrom("$env:WINDIR\Microsoft.NET\Framework\v3.0\WPF\PresentationCore.dll")
            }
            catch {
                # If WPF loading fails, skip this method
                throw "WPF not available"
            }
        }

        # Test if the WPF types are actually available
        try {
            $testType = [System.Windows.Media.Fonts]
            $wpfAssemblyLoaded = $true
        }
        catch {
            $wpfAssemblyLoaded = $false
        }
    }
    catch {
        # WPF isn't available - this is normal on older PowerShell versions or Server Core
        $wpfAssemblyLoaded = $false
    }

    if ($wpfAssemblyLoaded) {
        # First method: Using WPF (most comprehensive)
        try {
            $systemFamilies = [System.Windows.Media.Fonts]::SystemFontFamilies

            foreach ($family in $systemFamilies) {
                $name = $null
                # Try different ways to get the name, with enhanced compatibility
                try {
                    # Method 1: Try to get the English name directly
                    $langObj = [System.Windows.Markup.XmlLanguage]::GetLanguage('en-us')
                    $name = ""

                    # Use more compatible approach for TryGetValue in older PowerShell versions
                    $tempName = $null
                    try {
                        $gotName = $family.FamilyNames.TryGetValue($langObj, [ref]$tempName)
                        if ($gotName -and -not (Test-StringEmpty $tempName)) {
                            $name = $tempName
                        }
                    }
                    catch {
                        # TryGetValue might not work in very old PowerShell versions
                        $gotName = $false
                    }
                    
                    if (-not $gotName -or (Test-StringEmpty $name)) {
                        # Method 2: Try to get any name
                        try {
                            if ($family.FamilyNames.Keys.Count -gt 0) {
                                # More compatible way to get first key for older PS versions
                                $keys = @()
                                foreach ($key in $family.FamilyNames.Keys) {
                                    $keys += $key
                                    break  # Just get the first one
                                }
                                if ($keys.Count -gt 0) {
                                    $firstKey = $keys[0]
                                    if ($firstKey) {
                                        $name = $family.FamilyNames[$firstKey]
                                    }
                                }
                            }
                        }
                        catch {
                            # If this fails, continue to next method
                        }

                        # Method 3: Last resort - get name through Source property if available
                        if ((Test-StringEmpty $name) -and $family.Source) {
                            try {
                                $name = $family.Source
                            }
                            catch {
                                # If Source property access fails, continue
                            }
                        }
                    }
                }
                catch {
                    # If all structured approaches fail, try one more direct method
                    try {
                        $name = $family.ToString()
                    }
                    catch {
                        # Nothing more we can do
                        $name = $null
                    }
                }

                # Only add if we got a valid name and haven't seen this family before
                if (-not (Test-StringEmpty $name) -and -not $seenFamilies.ContainsKey($name)) {
                    $seenFamilies[$name] = $true

                    # Create object for system font family (no physical file)
                    $fontObject = New-Object PSObject
                    $fontObject | Add-Member -MemberType NoteProperty -Name "FullPath" -Value ""
                    $fontObject | Add-Member -MemberType NoteProperty -Name "Family" -Value $name
                    $fontObject | Add-Member -MemberType NoteProperty -Name "Face" -Value "Regular"

                    # Using ArrayList's Add method instead of += for better performance and compatibility
                    [void]$results.Add($fontObject)
                }
            }
        }
        catch {
            # If WPF enumeration fails for any reason, fall through to registry method
            Write-Warning "WPF font enumeration failed: $($_.Exception.Message)"
            $wpfAssemblyLoaded = $false
        }
    }

    if (-not $wpfAssemblyLoaded) {
        Write-Warning "WPF is not available in this PowerShell version, using registry-based fallback"
        throw "WPF not available"  # Force using fallback methods
    }
}
catch {
    # If WPF font enumeration fails, fall back to registry-based approach
    # Enhanced error handling for all PowerShell versions
    try {
        # Second method: Registry-based font detection (fallback)
        $registryFonts = Get-FontsFromRegistry
        foreach ($fontName in $registryFonts.Keys) {
            # Only add if we haven't seen this family name before
            if (-not $seenFamilies.ContainsKey($fontName)) {
                $seenFamilies[$fontName] = $true

                # Create object for system font family (no physical file)
                $fontObject = New-Object PSObject
                $fontObject | Add-Member -MemberType NoteProperty -Name "FullPath" -Value ""
                $fontObject | Add-Member -MemberType NoteProperty -Name "Family" -Value $fontName
                $fontObject | Add-Member -MemberType NoteProperty -Name "Face" -Value "Regular"

                # Using ArrayList's Add method instead of += for better performance and compatibility
                [void]$results.Add($fontObject)
            }
        }
    }
    catch {
        # If all methods fail, continue with file-based results only
        # More descriptive warning for troubleshooting
        Write-Warning "Could not enumerate system fonts from any source: $($_.Exception.Message)"
        Write-Warning "Continuing with file-based font detection only"
    }
}

# Output CSV header and process fonts to remove duplicates
# Enhanced compatibility for all PowerShell versions
Write-Output "FullPath,Family,Face"

# First pass: identify all fonts with full paths - optimized for PS 2.0
$fontFamilyWithPath = @{}
foreach ($font in $results) {
    if ($font.FullPath -ne $null -and $font.FullPath -ne "") {
        # Normalize by removing trailing spaces - PS 2.0 compatible
        $normalizedFamily = $font.Family
        if ($normalizedFamily -ne $null) {
            $normalizedFamily = $normalizedFamily.TrimEnd()
            if (-not $fontFamilyWithPath.ContainsKey($normalizedFamily)) {
                $fontFamilyWithPath[$normalizedFamily] = $true
            }
        }
    }
}

# Second pass: output fonts, skipping virtual fonts when a physical file exists
foreach ($font in $results) {
    # Normalize family name by removing trailing spaces - PS 2.0 compatible
    $normalizedFamily = $font.Family
    if ($normalizedFamily -ne $null) {
        $normalizedFamily = $normalizedFamily.TrimEnd()
    }
    else {
        $normalizedFamily = ""
    }

    # Skip this font if:
    # 1. It has no path (virtual font)
    # 2. The same font family exists with a full path
    $hasNoPath = ($font.FullPath -eq $null -or $font.FullPath -eq "")
    if ($hasNoPath -and $fontFamilyWithPath.ContainsKey($normalizedFamily)) {
        # Skip this virtual font as we have a physical file for this family
        continue
    }

    # For fonts we're keeping, ensure the family name has no trailing spaces
    $font.Family = $normalizedFamily

    # Escape commas and quotes in CSV values - enhanced PS 1.0/2.0 compatible approach
    $fullPath = $font.FullPath
    $family = $font.Family
    $face = $font.Face

    # Safe null checks for older PowerShell versions
    if ($fullPath -eq $null) { $fullPath = "" }
    if ($family -eq $null) { $family = "" }
    if ($face -eq $null) { $face = "" }

    # Replace quotes with double quotes for CSV escaping using safer methods
    if (Test-StringContains $fullPath '"') { 
        $fullPath = Invoke-StringReplace $fullPath '"' '""' 
    }
    if (Test-StringContains $family '"') { 
        $family = Invoke-StringReplace $family '"' '""' 
    }
    if (Test-StringContains $face '"') { 
        $face = Invoke-StringReplace $face '"' '""' 
    }

    # Quote values that contain commas - PS 1.0/2.0 compatible
    if (Test-StringContains $fullPath ',') { 
        $fullPath = '"' + $fullPath + '"' 
    }
    if (Test-StringContains $family ',') { 
        $family = '"' + $family + '"' 
    }
    if (Test-StringContains $face ',') { 
        $face = '"' + $face + '"' 
    }

    Write-Output "$fullPath,$family,$face"
}
