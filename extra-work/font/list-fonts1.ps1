# powershell.exe .\extra-work\font\list-fonts1.ps1 | code -
# https://forums.powershell.org/t/listing-font-details/9230/3

$folder = "C:\Windows\fonts\"
$objShell = New-Object -ComObject Shell.Application

$fileList = @()
$attrList = @{}
$details = (
    "Title",
    "Font style",
    "Show/hide",
    "Designed for",
    "Category",
    "Designer/foundry" ,
    "Font Embeddability",
    "Font type",
    "Family",
    "Date created",
    "Date modified",
    "Collection",
    "Font file names",
    "Font version"
)

#figure out what the possible metadata is
$objFolder = $objShell.namespace($folder)
for ($attr = 0 ; $attr -le 500; $attr++) {
    $attrName = $objFolder.getDetailsOf($objFolder.items, $attr)
    if ( $attrName -and ( -not $attrList.Contains($attrName) )) {
        $attrList.add( $attrName, $attr )
    }
}

#loop through all the fonts, and process
$objFolder = $objShell.namespace($folder)
foreach ($file in $objFolder.items()) {
    foreach ( $attr in $details) {
        $attrValue = $objFolder.getDetailsOf($file, $attrList[$attr])
        if ( $attrValue ) {
            Add-Member -InputObject $file -MemberType NoteProperty -Name $attr -value $attrValue
        }
    }
    $fileList += $file
}
$fileList
