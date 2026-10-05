Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-DocxText($filePath) {
    Write-Host "=================================================="
    Write-Host "FILE: $filePath"
    Write-Host "=================================================="
    
    $fullPath = Resolve-Path $filePath
    $zip = [System.IO.Compression.ZipFile]::OpenRead($fullPath)
    $entry = $zip.GetEntry("word/document.xml")
    if ($entry -ne $null) {
        $stream = $entry.Open()
        $reader = New-Object System.IO.StreamReader($stream)
        $xmlContent = $reader.ReadToEnd()
        $reader.Close()
        $stream.Close()
        
        [xml]$xml = $xmlContent
        $ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
        $ns.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
        
        $paragraphs = $xml.SelectNodes("//w:p", $ns)
        foreach ($p in $paragraphs) {
            $texts = $p.SelectNodes(".//w:t", $ns)
            $pText = ($texts | ForEach-Object { $_.InnerText }) -join ""
            if ($pText.Trim().Length -gt 0) {
                Write-Host $pText
            }
        }
    }
    $zip.Dispose()
}

Get-DocxText ".\Yeu_cau_khach_hang_he_thong_quan_ly_cung_ung_lao_dong.docx"
Get-DocxText ".\Dac_ta_he_thong_quan_ly_cung_ung_lao_dong.docx"
