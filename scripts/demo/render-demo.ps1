$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$videoInput = Join-Path $projectRoot "docs\demo\video\render\outcomeguard-demo-silent.webm"
$audioInput = Join-Path $projectRoot "docs\demo\video\audio\narration.wav"
$subtitleInput = "docs/demo/video/outcomeguard-demo.srt"
$videoOutput = Join-Path $projectRoot "docs\demo\video\outcomeguard-demo.mp4"

if (-not (Test-Path -LiteralPath $videoInput)) { throw "Missing capture. Run npm run demo:capture first." }
if (-not (Test-Path -LiteralPath $audioInput)) { throw "Missing MiMo narration. Run npm run demo:audio first." }

Push-Location $projectRoot
try {
  $subtitleFilter = "subtitles='$subtitleInput':force_style='FontName=Arial,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00131E1A,BorderStyle=1,Outline=2,Shadow=0,MarginV=34,Alignment=2'"
  & ffmpeg -y -hide_banner -loglevel warning -i $videoInput -i $audioInput -filter_complex "[0:v]trim=0:155,setpts=PTS-STARTPTS,$subtitleFilter[v];[1:a]atrim=0:155,asetpts=PTS-STARTPTS[a]" -map "[v]" -map "[a]" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -movflags +faststart -t 155 $videoOutput
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg render failed with exit code $LASTEXITCODE" }
  & ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate,sample_rate,channels -of json $videoOutput
  if ($LASTEXITCODE -ne 0) { throw "ffprobe verification failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}
