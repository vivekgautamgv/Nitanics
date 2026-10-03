param([string]$Voice = 'Microsoft Mark', [int]$SpeechRate = 1)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$taskStory = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot 'story.json') | ConvertFrom-Json
$taskSpeech = New-Object System.Speech.Synthesis.SpeechSynthesizer
Write-Output ('Loading local narration voice: ' + $Voice)
$taskSpeech.SelectVoice($Voice)
Write-Output 'Voice ready'
$taskSpeech.Rate = $SpeechRate
$taskSpeech.Volume = 100
$taskFormat = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(48000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
foreach ($taskScene in $taskStory) {
    $taskSentences = [regex]::Split($taskScene.narration, '(?<=[.!?])\s+')
    $taskSentenceIndex = 0
    foreach ($taskSentence in $taskSentences) {
        $taskSentenceIndex++
        $taskNarration = [System.Security.SecurityElement]::Escape($taskSentence)
        $taskNarration = $taskNarration.Replace('Nitanics', '<sub alias="nee tan icks">Nitanics</sub>')
        $taskNarration = $taskNarration.Replace('Neo4j', '<sub alias="Neo four jay">Neo4j</sub>')
        $taskNarration = $taskNarration.Replace('MCP', '<say-as interpret-as="characters">MCP</say-as>')
        $taskNarration = $taskNarration.Replace('API', '<say-as interpret-as="characters">API</say-as>')
        $taskNarration = $taskNarration.Replace('UI', '<say-as interpret-as="characters">UI</say-as>')
        $taskNarration = $taskNarration.Replace('PDFs', '<sub alias="P D Fs">PDFs</sub>')
        $taskNarration = $taskNarration.Replace('JSON', '<sub alias="jay son">JSON</sub>')
        $taskSsml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">' + $taskNarration + '</speak>'
        $taskFileName = 'voice-' + $taskScene.id + '-s' + $taskSentenceIndex.ToString('00') + '.wav'
        $taskSpeech.SetOutputToWaveFile((Join-Path $PSScriptRoot $taskFileName), $taskFormat)
        $taskSpeech.SpeakSsml($taskSsml)
        $taskSpeech.SetOutputToNull()
        Write-Output ('Narrated: ' + $taskFileName)
    }
}
$taskSpeech.Dispose()
