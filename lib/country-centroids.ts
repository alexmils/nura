/** Country centroids for admin pins. Missing codes still appear in the table. */
const RAW = `
US 39.8 -98.6
CA 56.1 -106.3
MX 23.6 -102.5
BR -14.2 -51.9
AR -38.4 -63.6
CL -35.7 -71.5
CO 4.6 -74.3
PE -9.2 -75.0
GB 54.0 -2.5
IE 53.1 -8.0
FR 46.2 2.2
DE 51.2 10.4
ES 40.5 -3.7
PT 39.4 -8.2
IT 41.9 12.6
NL 52.1 5.3
BE 50.5 4.5
CH 46.8 8.2
AT 47.5 14.6
PL 51.9 19.1
CZ 49.8 15.5
SK 48.7 19.7
HU 47.2 19.5
RO 45.9 24.9
BG 42.7 25.5
GR 39.1 21.8
RS 44.0 21.0
HR 45.1 15.2
BA 43.9 17.7
SI 46.2 14.8
ME 42.7 19.4
MK 41.6 21.7
AL 41.2 20.2
XK 42.6 20.9
UA 48.4 31.2
MD 47.4 28.4
TR 39.0 35.2
SE 60.1 18.6
NO 60.5 8.5
DK 56.3 9.5
FI 61.9 25.7
IS 64.9 -19.0
EE 58.6 25.0
LV 56.9 24.6
LT 55.2 23.9
RU 61.5 105.3
CN 35.9 104.2
JP 36.2 138.3
KR 35.9 127.8
IN 20.6 79.0
PK 30.4 69.3
BD 23.7 90.4
ID -0.8 113.9
PH 12.9 121.8
TH 15.9 100.9
VN 14.1 108.3
MY 4.2 101.9
SG 1.4 103.8
AU -25.3 133.8
NZ -40.9 174.9
ZA -30.6 22.9
NG 9.1 8.7
EG 26.8 30.8
KE -0.02 37.9
MA 31.8 -7.1
AE 23.4 53.8
SA 23.9 45.1
IL 31.0 34.9
QA 25.3 51.2
`.trim();

const CENTROIDS = new Map<string, { lat: number; lng: number }>();
for (const line of RAW.split("\n")) {
  const [code, lat, lng] = line.trim().split(/\s+/);
  if (!code || lat === undefined || lng === undefined) continue;
  CENTROIDS.set(code, { lat: Number(lat), lng: Number(lng) });
}

export function countryCentroid(
  code: string | null | undefined
): { lat: number; lng: number } | null {
  if (!code) return null;
  return CENTROIDS.get(code.toUpperCase()) ?? null;
}
