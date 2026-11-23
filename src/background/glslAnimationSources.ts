import type {
    GlslAnimationNameType,
    GlslAnimationType,
} from './animationValueHelpers';

/**
 * The shaders a GLSL animation runs (`glslAnimationRuntime`): the built-in
 * ones and the frame around a person's own.
 *
 * WebGL 1 / GLSL ES 1.00 on purpose: it is what every old church computer's
 * graphics card speaks, and its loops must have constant bounds -- a shader
 * cannot be written to spin forever.
 *
 * The contract is Shadertoy's, so a simple shader found there can be pasted
 * in as it is: `void mainImage(out vec4 fragColor, in vec2 fragCoord)`,
 * `iTime` in seconds and `iResolution` in pixels. On top of it the colours
 * the person chose -- `uColors[4]` (straight alpha), `uColorCount`, and the
 * helpers below: `groundColor()`, `paletteColor(t)` / `palette(t)` (the
 * light, cycling through every colour but the ground), `rampColor(t)` (the
 * same light as a ramp, first to last), `lightOver()`, and `noise()` /
 * `fbm()` / `hash21()` / `hash22()`. `fragColor` is straight alpha; the frame makes it
 * premultiplied for the canvas, so a see-through ground shows what is under
 * the screen (a Screen Show's other screen).
 *
 * ASCII only, here and in a person's code (`checkGlslCodeProblem`).
 */

export const GLSL_VERTEX_SOURCE = `attribute vec2 aPosition;
void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const GLSL_HEADER_SOURCE = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec3 iResolution;
uniform float iTime;
uniform vec4 uColors[4];
uniform int uColorCount;

vec4 colorAt(int index) {
    if (index <= 0) {
        return uColors[0];
    }
    if (index == 1) {
        return uColors[1];
    }
    if (index == 2) {
        return uColors[2];
    }
    return uColors[3];
}

vec4 groundColor() {
    return uColors[0];
}

// The light: every colour but the ground, in turn, t from 0 to 1 and round.
vec4 paletteColor(float t) {
    int lightCount = uColorCount - 1;
    if (lightCount <= 1) {
        return colorAt(1);
    }
    float position = fract(t) * float(lightCount);
    int index = int(floor(position));
    int nextIndex = index + 1;
    if (nextIndex >= lightCount) {
        nextIndex = 0;
    }
    float amount = smoothstep(0.0, 1.0, fract(position));
    return mix(colorAt(index + 1), colorAt(nextIndex + 1), amount);
}

vec3 palette(float t) {
    return paletteColor(t).rgb;
}

// The light as a ramp, not a wheel: 0 is the first light, 1 the last.
vec4 rampColor(float t) {
    int lightCount = uColorCount - 1;
    if (lightCount <= 1) {
        return colorAt(1);
    }
    float position = clamp(t, 0.0, 1.0) * float(lightCount - 1);
    int index = int(floor(position));
    int nextIndex = index + 1;
    if (nextIndex > lightCount - 1) {
        nextIndex = lightCount - 1;
    }
    return mix(colorAt(index + 1), colorAt(nextIndex + 1), fract(position));
}

// \`light\` laid over \`base\` at \`amount\`, both straight alpha.
vec4 lightOver(vec4 base, vec4 light, float amount) {
    float sourceAlpha = light.a * clamp(amount, 0.0, 1.0);
    float alpha = sourceAlpha + base.a * (1.0 - sourceAlpha);
    if (alpha <= 0.0) {
        return vec4(0.0);
    }
    vec3 color = (light.rgb * sourceAlpha + base.rgb * base.a * (1.0 - sourceAlpha)) / alpha;
    return vec4(color, alpha);
}

float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
}

vec2 hash22(vec2 point) {
    vec3 value = fract(vec3(point.xyx) * vec3(0.1031, 0.1030, 0.0973));
    value += dot(value, value.yzx + 33.33);
    return fract((value.xx + value.yz) * value.zy);
}

float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 part = fract(point);
    vec2 curve = part * part * (3.0 - 2.0 * part);
    return mix(
        mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), curve.x),
        mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0, 1.0)), curve.x),
        curve.y
    );
}

float fbm(vec2 point) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 4; octave++) {
        value += amplitude * noise(point);
        point = point * 2.03 + vec2(17.0, 9.0);
        amplitude *= 0.5;
    }
    return value;
}
`;

export const GLSL_FOOTER_SOURCE = `
void main() {
    vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
    mainImage(color, gl_FragCoord.xy);
    color = clamp(color, 0.0, 1.0);
    gl_FragColor = vec4(color.rgb * color.a, color.a);
}
`;

export const GLSL_BUILT_IN_SOURCE_MAP: Record<GlslAnimationNameType, string> = {
    plasma: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 point = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float time = iTime * 0.35;
    float value = sin(point.x * 3.0 + time);
    value += sin((point.y * 3.0 + time) * 0.8);
    value += sin(point.x * 2.0 + point.y * 2.5 + time * 1.3);
    vec2 center = point + 0.6 * vec2(sin(time * 0.7), cos(time * 0.5));
    value += sin(sqrt(dot(center, center) * 9.0 + 1.0) - time);
    float shine = 0.5 + 0.5 * sin(value * 1.2);
    vec4 light = paletteColor(value * 0.12 + time * 0.05);
    fragColor = lightOver(groundColor(), light, 0.3 + 0.7 * shine);
}
`,
    flow: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 point = fragCoord / iResolution.y * 2.2;
    float time = iTime * 0.08;
    vec2 warp = vec2(fbm(point + vec2(0.0, time)), fbm(point + vec2(5.2, -time)));
    vec2 swirl = vec2(
        fbm(point + 3.0 * warp + vec2(1.7, 9.2) + time * 1.5),
        fbm(point + 3.0 * warp + vec2(8.3, 2.8) - time)
    );
    float value = fbm(point + 3.0 * swirl);
    vec4 light = paletteColor(value * 1.4 + swirl.x * 0.6);
    fragColor = lightOver(groundColor(), light, smoothstep(0.25, 0.85, value));
}
`,
    mesh: `vec4 meshColor(int index) {
    if (index < uColorCount) {
        return colorAt(index);
    }
    return colorAt(index - uColorCount);
}

float meshWeight(vec2 point, vec2 anchor, vec2 aspect) {
    vec2 offset = (point - anchor) * aspect;
    return 1.0 / (0.015 + pow(dot(offset, offset), 1.1));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 point = fragCoord / iResolution.xy;
    vec2 aspect = vec2(iResolution.x / iResolution.y, 1.0);
    float time = iTime * 0.15;
    vec2 anchor0 = vec2(0.2 + 0.15 * sin(time * 1.1), 0.25 + 0.2 * cos(time * 0.9));
    vec2 anchor1 = vec2(0.8 + 0.12 * cos(time * 0.8), 0.3 + 0.18 * sin(time * 1.3));
    vec2 anchor2 = vec2(0.3 + 0.18 * cos(time * 1.2), 0.8 + 0.12 * sin(time * 0.7));
    vec2 anchor3 = vec2(0.75 + 0.15 * sin(time * 0.6), 0.75 + 0.15 * cos(time * 1.0));
    float weight0 = meshWeight(point, anchor0, aspect);
    float weight1 = meshWeight(point, anchor1, aspect);
    float weight2 = meshWeight(point, anchor2, aspect);
    float weight3 = meshWeight(point, anchor3, aspect);
    vec4 color = meshColor(0) * weight0 + meshColor(1) * weight1
        + meshColor(2) * weight2 + meshColor(3) * weight3;
    fragColor = color / (weight0 + weight1 + weight2 + weight3);
}
`,
    aurora: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 point = fragCoord / iResolution.xy;
    float time = iTime * 0.12;
    float pixel = 1.5 / iResolution.y;
    vec4 color = groundColor();
    for (int index = 0; index < 3; index++) {
        float layer = float(index);
        float along = point.x * (1.5 + layer * 0.6) + time * (0.6 + 0.25 * layer) + layer * 3.1;
        float band = 0.6 - 0.1 * layer + 0.24 * (fbm(vec2(along, layer * 7.0 + time * 0.5)) - 0.5);
        float above = point.y - band;
        float curtain = smoothstep(-pixel, pixel * 4.0, above) * exp(-max(above, 0.0) * 5.0);
        curtain *= 0.55 + 0.45 * noise(vec2(along * 18.0, time * 2.0 + layer));
        float glow = exp(-above * above * 400.0) * 0.6;
        color = lightOver(color, paletteColor(layer / 3.0 + time * 0.05), (curtain + glow) * 0.85);
    }
    fragColor = color;
}
`,
    waves: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 point = fragCoord / iResolution.xy;
    float time = iTime * 0.5;
    float pixel = 1.5 / iResolution.y;
    vec4 color = groundColor();
    for (int index = 0; index < 4; index++) {
        float layer = float(index);
        float line = 0.55 - layer * 0.12
            + 0.05 * sin(point.x * (6.0 + layer * 2.0) + time * (1.0 + layer * 0.35) + layer)
            + 0.03 * sin(point.x * 13.0 - time * 1.7 + layer * 2.0);
        float below = smoothstep(line + pixel, line - pixel, point.y);
        color = lightOver(color, paletteColor(layer * 0.27), below * (0.45 + layer * 0.15));
    }
    fragColor = color;
}
`,
    rays: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 point = fragCoord / iResolution.xy;
    vec2 offset = point - vec2(0.5, 1.08);
    offset.x *= iResolution.x / iResolution.y;
    float angle = atan(offset.x, -offset.y);
    float time = iTime * 0.2;
    float rays = 0.5 + 0.5 * sin(angle * 14.0 + time * 2.0 + 2.0 * sin(time + angle * 3.0));
    rays *= 0.5 + 0.5 * sin(angle * 23.0 - time * 1.3);
    float fall = smoothstep(1.4, 0.0, length(offset));
    vec4 color = groundColor();
    color = lightOver(color, paletteColor(angle * 0.15 + time * 0.05), rays * fall * 0.8);
    color = lightOver(color, paletteColor(0.0), fall * fall * 0.35);
    fragColor = color;
}
`,
    clouds: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 point = fragCoord / iResolution.xy;
    vec2 scaled = fragCoord / iResolution.y;
    float time = iTime * 0.03;
    vec4 sky = lightOver(groundColor(), rampColor(1.0), smoothstep(1.0, 0.0, point.y) * 0.3);
    float shape = fbm(scaled * 2.2 + vec2(time * 2.0, 0.0));
    shape += 0.5 * fbm(scaled * 4.5 + vec2(time * 3.5, time));
    float cloud = smoothstep(0.55, 0.95, shape);
    vec4 cloudColor = mix(rampColor(1.0), rampColor(0.0), smoothstep(0.5, 1.2, shape));
    vec4 color = lightOver(sky, cloudColor, cloud);
    float glow = exp(-length((point - vec2(0.5, 1.05)) * vec2(1.4, 2.4)) * 2.5);
    fragColor = lightOver(color, rampColor(0.0), glow * 0.45);
}
`,
    cross: `float boxDistance(vec2 point, vec2 halfSize) {
    vec2 outside = abs(point) - halfSize;
    return length(max(outside, 0.0)) + min(max(outside.x, outside.y), 0.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 point = (fragCoord - vec2(0.5 * iResolution.x, 0.55 * iResolution.y)) / iResolution.y;
    float time = iTime * 0.25;
    float pixel = 1.5 / iResolution.y;
    float distance = min(
        boxDistance(point - vec2(0.0, -0.06), vec2(0.022, 0.3)),
        boxDistance(point - vec2(0.0, 0.1), vec2(0.17, 0.022))
    );
    vec4 crossColor = colorAt(1);
    vec4 glowColor = uColorCount > 2 ? colorAt(2) : crossColor;
    vec4 rayColor = uColorCount > 3 ? colorAt(3) : glowColor;
    float angle = atan(point.x, point.y);
    float rays = 0.5 + 0.5 * sin(angle * 12.0 + time * 1.5 + sin(time + angle * 2.0));
    rays *= smoothstep(1.2, 0.05, length(point));
    float breathe = 0.75 + 0.25 * sin(time * 2.0);
    vec4 color = groundColor();
    color = lightOver(color, rayColor, rays * 0.35 * breathe);
    color = lightOver(color, glowColor, exp(-max(distance, 0.0) * 18.0) * 0.85 * breathe);
    fragColor = lightOver(color, crossColor, smoothstep(pixel, -pixel, distance));
}
`,
    flames: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 point = fragCoord / iResolution.xy;
    float across = fragCoord.x / iResolution.y;
    float time = iTime * 0.6;
    float turbulence = fbm(vec2(across * 3.0, point.y * 2.0 - time));
    turbulence += 0.5 * fbm(vec2(across * 6.0 + 3.0, point.y * 4.0 - time * 1.7));
    float fire = smoothstep(0.15, 1.0, (1.0 - point.y) * 1.15 + turbulence * 0.55 - 0.35);
    fire *= 0.7 + 0.3 * sin(across * 9.0 + time * 0.5 + turbulence * 4.0);
    vec4 color = groundColor();
    color = lightOver(color, rampColor(0.0), smoothstep(0.0, 0.5, fire));
    color = lightOver(color, rampColor(0.5), smoothstep(0.35, 0.8, fire));
    fragColor = lightOver(color, rampColor(1.0), smoothstep(0.65, 1.0, fire));
}
`,
    glass: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 point = fragCoord / iResolution.y * 5.0;
    float time = iTime * 0.15;
    vec2 cell = floor(point);
    vec2 part = fract(point);
    float nearest = 8.0;
    float second = 8.0;
    vec2 nearestCell = vec2(0.0);
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 seed = hash22(cell + neighbor);
            vec2 center = neighbor + 0.5 + 0.35 * sin(time + 6.2831 * seed);
            float distance = length(center - part);
            if (distance < nearest) {
                second = nearest;
                nearest = distance;
                nearestCell = cell + neighbor;
            } else if (distance < second) {
                second = distance;
            }
        }
    }
    float lead = smoothstep(0.02, 0.07, second - nearest);
    vec4 glass = paletteColor(hash21(nearestCell) + time * 0.05);
    float light = 0.65 + 0.35 * sin(time * 2.0 + point.x * 0.6 + point.y * 0.4);
    glass.rgb *= light + 0.25 * (1.0 - nearest);
    fragColor = mix(groundColor(), glass, lead);
}
`,
    ripples: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 flow = fragCoord / iResolution.y * 3.0;
    float time = iTime * 0.4;
    float wave = 0.0;
    for (int index = 0; index < 4; index++) {
        float layer = float(index);
        vec2 direction = vec2(cos(layer * 1.7 + 0.3), sin(layer * 1.7 + 0.3));
        wave += sin(dot(flow, direction) * (2.0 + layer) + time * (1.0 + layer * 0.3)
            + fbm(flow + layer + time * 0.2) * 2.0);
    }
    wave /= 4.0;
    float caustic = pow(1.0 - abs(wave), 6.0);
    vec4 color = lightOver(groundColor(), rampColor(0.5 + 0.5 * wave), 0.55);
    fragColor = lightOver(color, rampColor(1.0), caustic * 0.7);
}
`,
    snow: `float snowLayer(vec2 point, float scale, float speed, float time, float size) {
    vec2 grid = point * scale;
    grid.y += time * speed;
    grid.x += sin(time * 0.5 + grid.y * 0.3) * 0.5;
    vec2 cell = floor(grid);
    vec2 center = 0.2 + 0.6 * hash22(cell);
    float distance = length(fract(grid) - center);
    return step(0.45, hash21(cell + 3.1)) * smoothstep(size, size * 0.3, distance);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 point = fragCoord / iResolution.y;
    float time = iTime;
    vec4 color = lightOver(groundColor(), rampColor(0.0), (1.0 - fragCoord.y / iResolution.y) * 0.18);
    color = lightOver(color, rampColor(1.0), snowLayer(point, 6.0, 0.35, time, 0.06) * 0.55);
    color = lightOver(color, rampColor(0.5), snowLayer(point + 3.7, 10.0, 0.5, time, 0.08) * 0.75);
    fragColor = lightOver(color, rampColor(0.0), snowLayer(point + 9.1, 16.0, 0.8, time, 0.1));
}
`,
    sunrise: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 point = fragCoord / iResolution.xy;
    vec2 scaled = (fragCoord - vec2(0.5 * iResolution.x, 0.0)) / iResolution.y;
    float time = iTime * 0.05;
    float pixel = 1.5 / iResolution.y;
    float horizon = 0.32;
    vec2 sun = vec2(0.0, horizon + 0.08 + 0.05 * sin(time));
    vec4 color = mix(rampColor(0.0), groundColor(), smoothstep(horizon, 1.0, point.y));
    vec2 fromSun = scaled - sun;
    float distance = length(fromSun);
    float rays = 0.5 + 0.5 * sin(atan(fromSun.x, fromSun.y) * 16.0 + iTime * 0.3);
    color = lightOver(color, rampColor(0.5), rays * smoothstep(1.0, 0.1, distance) * 0.3 * step(horizon, point.y));
    color = lightOver(color, rampColor(0.5), exp(-distance * 4.0) * 0.8);
    color = lightOver(color, rampColor(1.0), smoothstep(0.1, 0.085, distance));
    float hill = horizon + 0.02 * sin(scaled.x * 4.0 + 1.0) + 0.015 * sin(scaled.x * 9.0);
    // A shade of the ground: much darker on a dark one, a pale hill on a
    // pale one (the Light side), where darker would be a grey band.
    vec3 ground = groundColor().rgb;
    vec3 landColor = ground * 0.45;
    if (dot(ground, vec3(0.299, 0.587, 0.114)) > 0.5) {
        landColor = mix(ground, rampColor(0.0).rgb, 0.18) * 0.92;
    }
    vec4 land = vec4(landColor, max(groundColor().a, 0.85));
    fragColor = lightOver(color, land, smoothstep(hill + pixel, hill - pixel, point.y));
}
`,
    stars: `float starLayer(vec2 point, float scale, float time) {
    vec2 grid = point * scale;
    vec2 cell = floor(grid);
    float seed = hash21(cell);
    vec2 offset = hash22(cell + 1.7) - 0.5;
    float distance = length(fract(grid) - 0.5 - offset * 0.7);
    float twinkle = 0.55 + 0.45 * sin(time * (1.0 + seed * 3.0) + seed * 40.0);
    return step(0.72, seed) * smoothstep(0.06, 0.0, distance) * twinkle;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 point = fragCoord / iResolution.y;
    float time = iTime;
    vec4 color = lightOver(groundColor(), rampColor(0.0), smoothstep(0.6, 0.0, fragCoord.y / iResolution.y) * 0.25);
    color = lightOver(color, rampColor(0.3), starLayer(point, 18.0, time));
    color = lightOver(color, rampColor(0.7), starLayer(point + 5.3, 32.0, time * 1.3) * 0.8);
    vec2 star = (fragCoord - vec2(0.68 * iResolution.x, 0.74 * iResolution.y)) / iResolution.y;
    float glow = exp(-length(star) * 22.0);
    float glints = exp(-abs(star.x) * 160.0) * exp(-abs(star.y) * 6.0)
        + exp(-abs(star.y) * 160.0) * exp(-abs(star.x) * 9.0);
    float pulse = 0.85 + 0.15 * sin(time * 1.5);
    fragColor = lightOver(color, rampColor(1.0), (glow + glints * 0.6) * pulse);
}
`,
    leaves: `// A leaf: two circles' overlap, pointed at both ends.
float leafDistance(vec2 point) {
    return length(vec2(abs(point.x) + 0.6, point.y)) - 1.0;
}

// One leaf in a cell at most, falling with the cells and swinging.
vec4 leafLayer(vec4 color, vec2 point, float scale, float speed, float amount) {
    vec2 grid = point * scale;
    grid.y += iTime * speed;
    vec2 cell = floor(grid);
    vec2 seed = hash22(cell);
    float swing = sin(iTime * (0.8 + seed.x) + seed.y * 6.2831);
    vec2 center = 0.3 + 0.4 * seed + vec2(swing * 0.1, 0.0);
    float angle = seed.x * 6.2831 + swing * 0.9;
    vec2 local = (fract(grid) - center) / 0.2;
    vec2 turned = vec2(
        cos(angle) * local.x - sin(angle) * local.y,
        sin(angle) * local.x + cos(angle) * local.y
    );
    float edge = scale / iResolution.y / 0.2;
    float leaf = smoothstep(edge, -edge, leafDistance(turned));
    leaf *= step(0.5, hash21(cell + 3.1));
    vec4 leafColor = paletteColor(seed.y + seed.x * 0.5);
    float vein = smoothstep(edge * 2.0 + 0.04, 0.0, abs(turned.x)) * step(abs(turned.y), 0.7);
    leafColor.rgb *= (0.82 + 0.18 * step(0.0, turned.x)) * (1.0 - 0.3 * vein);
    return lightOver(color, leafColor, leaf * amount);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 point = fragCoord / iResolution.y;
    vec4 color = lightOver(groundColor(), rampColor(0.0), (1.0 - fragCoord.y / iResolution.y) * 0.15);
    color = leafLayer(color, point, 7.0, 0.25, 0.55);
    color = leafLayer(color, point + 4.3, 4.5, 0.35, 0.8);
    fragColor = leafLayer(color, point + 9.7, 3.0, 0.5, 1.0);
}
`,
    fireworks: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float aspect = iResolution.x / iResolution.y;
    vec2 point = fragCoord / iResolution.y;
    float width = 0.003 + 1.5 / iResolution.y;
    vec4 color = lightOver(groundColor(), rampColor(0.0), smoothstep(0.6, 0.0, fragCoord.y / iResolution.y) * 0.2);
    for (int index = 0; index < 6; index++) {
        float layer = float(index);
        float period = 3.4 + 1.6 * hash21(vec2(layer, 7.1));
        float clock = iTime / period + hash21(vec2(layer, 2.3));
        float cycle = floor(clock);
        // A burst, then dark a while before the next one.
        float progress = fract(clock) * 1.5;
        if (progress < 1.0) {
            vec2 seed = hash22(vec2(layer * 13.7, cycle));
            vec2 center = vec2((0.12 + 0.76 * seed.x) * aspect, 0.5 + 0.36 * seed.y);
            center.y -= progress * progress * 0.06;
            float radius = (0.12 + 0.1 * hash21(vec2(cycle, layer)))
                * (1.0 - pow(1.0 - progress, 3.0));
            vec2 offset = point - center;
            float len = length(offset);
            float sector = 6.2831 / 14.0;
            float turn = mod(atan(offset.y, offset.x) + seed.y * 6.2831, sector) - 0.5 * sector;
            float ray = smoothstep(width, 0.0, len * abs(sin(turn)));
            float trail = smoothstep(radius * 0.35, radius, len)
                * smoothstep(radius + width * 2.0, radius - width, len);
            float tip = smoothstep(radius * 0.8, radius, len) * trail;
            float fade = 1.0 - smoothstep(0.35, 1.0, progress);
            float flash = exp(-len * len / 0.0015) * (1.0 - smoothstep(0.0, 0.2, progress));
            float hue = hash21(vec2(cycle, layer * 3.1));
            color = lightOver(color, paletteColor(hue), exp(-len / max(radius, 0.01) * 3.0) * 0.12 * fade);
            color = lightOver(color, paletteColor(hue), (ray * trail * 0.9 + flash) * fade);
            color = lightOver(color, paletteColor(hue + 0.5), ray * tip * fade * 0.8);
        }
    }
    fragColor = color;
}
`,
    petals: `// A petal, rounder at the bottom than the top.
float petalDistance(vec2 point) {
    point.x *= 1.0 + 0.35 * point.y;
    return length(point * vec2(1.25, 0.9)) - 1.0;
}

// One petal in a cell at most, drifting down and turning over.
vec4 petalLayer(vec4 color, vec2 point, float scale, float speed, float amount) {
    vec2 grid = point * scale;
    grid.y += iTime * speed;
    grid.x += sin(iTime * 0.4 + grid.y * 0.5) * 0.4;
    vec2 cell = floor(grid);
    vec2 seed = hash22(cell);
    float angle = seed.x * 6.2831 + iTime * (seed.y - 0.5);
    float flip = cos(iTime * (1.2 + seed.y * 1.6) + seed.x * 6.2831);
    vec2 local = (fract(grid) - 0.3 - 0.4 * seed) / 0.17;
    vec2 turned = vec2(
        cos(angle) * local.x - sin(angle) * local.y,
        sin(angle) * local.x + cos(angle) * local.y
    );
    turned.x /= max(abs(flip), 0.15);
    float edge = scale / iResolution.y / 0.17;
    float petal = smoothstep(edge, -edge, petalDistance(turned));
    petal *= step(0.45, hash21(cell + 2.7));
    vec4 petalColor = paletteColor(hash21(cell + 6.1));
    petalColor.rgb *= (0.8 + 0.2 * step(0.0, flip)) * (0.85 + 0.15 * (1.0 - length(turned)));
    return lightOver(color, petalColor, petal * amount);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 point = fragCoord / iResolution.y;
    vec4 color = lightOver(groundColor(), rampColor(0.5), smoothstep(1.0, 0.0, fragCoord.y / iResolution.y) * 0.18);
    color = petalLayer(color, point, 9.0, 0.22, 0.55);
    color = petalLayer(color, point + 3.9, 6.0, 0.3, 0.8);
    fragColor = petalLayer(color, point + 8.3, 4.0, 0.42, 1.0);
}
`,
    candles: `float candleBox(vec2 point, vec2 halfSize) {
    vec2 outside = abs(point) - halfSize;
    return length(max(outside, 0.0)) + min(max(outside.x, outside.y), 0.0);
}

// Soft lights far behind, drifting up.
float glowLayer(vec2 point) {
    vec2 grid = point * 5.0 - vec2(0.0, iTime * 0.04);
    vec2 cell = floor(grid);
    float distance = length(fract(grid) - 0.25 - 0.5 * hash22(cell));
    return step(0.6, hash21(cell + 8.3)) * smoothstep(0.25, 0.05, distance);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float aspect = iResolution.x / iResolution.y;
    vec2 point = fragCoord / iResolution.y;
    float pixel = 1.5 / iResolution.y;
    vec4 wax = rampColor(0.0);
    vec4 flameColor = rampColor(0.6);
    vec4 core = rampColor(1.0);
    vec4 color = lightOver(groundColor(), core, exp(-fragCoord.y / iResolution.y * 3.0) * 0.2);
    color = lightOver(color, flameColor, glowLayer(point) * 0.12);
    for (int index = 0; index < 7; index++) {
        float layer = float(index);
        float seed = hash21(vec2(layer, 4.7));
        // The far ones smaller and higher.
        float depth = 0.5 + 0.5 * sin(layer * 2.3 + 1.0);
        float size = 0.022 + 0.022 * depth;
        float height = size * (2.6 + seed * 1.6);
        float x = ((layer + 0.5) / 7.0 + (seed - 0.5) * 0.06) * aspect;
        float wick = 0.1 + height + 0.16 * (1.0 - depth);
        vec2 flameCenter = vec2(x, wick + size * 0.85);
        float flicker = 0.85 + 0.15 * sin(iTime * (7.0 + seed * 5.0) + seed * 20.0)
            * sin(iTime * (3.1 + seed) + layer);
        color = lightOver(color, flameColor, exp(-length(point - flameCenter) / (size * 2.2)) * 0.45 * flicker);
        float body = candleBox(point - vec2(x, wick - height * 0.5), vec2(size * 0.5, height * 0.5));
        vec4 bodyColor = wax;
        bodyColor.rgb *= 0.7 + 0.3 * smoothstep(size * 0.5, -size * 0.2, point.x - x);
        color = lightOver(color, bodyColor, smoothstep(pixel, -pixel, body) * 0.92);
        vec2 local = (point - flameCenter) / (size * 0.9);
        local.x += 0.12 * sin(iTime * 9.0 + seed * 20.0) * (local.y + 1.0) * 0.5;
        local.y /= 1.0 + 0.08 * sin(iTime * 13.0 + seed * 7.0);
        local.x *= 1.0 + max(local.y, 0.0) * 1.2;
        float flame = smoothstep(1.0, 0.6, length(local * vec2(2.2, 1.0)));
        color = lightOver(color, flameColor, flame * flicker);
        color = lightOver(color, core, smoothstep(0.55, 0.2, length((local + vec2(0.0, 0.35)) * vec2(2.6, 1.4))) * flicker);
    }
    fragColor = color;
}
`,
    confetti: `// One ribbon in a cell at most: a little box, turning and flipping.
vec4 confettiLayer(vec4 color, vec2 point, float scale, float speed, float amount) {
    vec2 grid = point * scale;
    grid.y += iTime * speed;
    vec2 cell = floor(grid);
    vec2 seed = hash22(cell);
    vec2 center = 0.25 + 0.5 * seed
        + vec2(0.08 * sin(iTime * (1.0 + seed.y) + seed.x * 6.2831), 0.0);
    float angle = seed.y * 6.2831 + iTime * (seed.x - 0.5) * 2.0;
    float flip = cos(iTime * (2.0 + 3.0 * seed.x) + seed.y * 6.2831);
    vec2 local = fract(grid) - center;
    vec2 turned = vec2(
        cos(angle) * local.x - sin(angle) * local.y,
        sin(angle) * local.x + cos(angle) * local.y
    );
    vec2 outside = abs(turned) - vec2(0.07, 0.15 * max(abs(flip), 0.12));
    float distance = length(max(outside, 0.0)) + min(max(outside.x, outside.y), 0.0);
    float pixel = scale / iResolution.y;
    float piece = smoothstep(pixel, -pixel, distance) * step(0.4, hash21(cell + 5.3));
    vec4 pieceColor = paletteColor(hash21(cell + 1.9));
    pieceColor.rgb *= 0.75 + 0.25 * abs(flip);
    return lightOver(color, pieceColor, piece * amount);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 point = fragCoord / iResolution.y;
    vec4 color = lightOver(groundColor(), rampColor(0.0), smoothstep(0.0, 1.0, fragCoord.y / iResolution.y) * 0.12);
    color = confettiLayer(color, point, 10.0, 0.45, 0.6);
    color = confettiLayer(color, point + 2.9, 7.0, 0.6, 0.85);
    fragColor = confettiLayer(color, point + 7.7, 5.0, 0.8, 1.0);
}
`,
    hearts: `// A heart standing on its point at the origin, about one tall.
float heartDistance(vec2 point) {
    point.x = abs(point.x);
    if (point.y + point.x > 1.0) {
        return length(point - vec2(0.25, 0.75)) - 0.3536;
    }
    vec2 toTop = point - vec2(0.0, 1.0);
    vec2 toSide = point - 0.5 * max(point.x + point.y, 0.0);
    return sqrt(min(dot(toTop, toTop), dot(toSide, toSide))) * sign(point.x - point.y);
}

// One heart in a cell at most, rising with the cells and swaying.
vec4 heartLayer(vec4 color, vec2 point, float scale, float speed, float amount) {
    vec2 grid = point * scale;
    grid.y -= iTime * speed;
    vec2 cell = floor(grid);
    vec2 seed = hash22(cell);
    float angle = 0.25 * sin(iTime * (0.9 + seed.x) + seed.y * 6.2831);
    float beat = 1.0 + 0.06 * pow(0.5 + 0.5 * sin(iTime * 2.4 + seed.x * 6.2831), 4.0);
    vec2 local = (fract(grid) - 0.3 - 0.4 * seed) / (0.2 * beat);
    vec2 turned = vec2(
        cos(angle) * local.x - sin(angle) * local.y,
        sin(angle) * local.x + cos(angle) * local.y
    );
    float edge = scale / iResolution.y / 0.2;
    float heart = smoothstep(edge, -edge, heartDistance(turned + vec2(0.0, 0.5)));
    heart *= step(0.55, hash21(cell + 4.4));
    vec4 heartColor = paletteColor(hash21(cell + 0.7));
    heartColor.rgb *= 0.85 + 0.25 * smoothstep(0.6, -0.4, turned.x - turned.y);
    return lightOver(color, heartColor, heart * amount);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 point = fragCoord / iResolution.y;
    float height = fragCoord.y / iResolution.y;
    vec4 color = lightOver(groundColor(), rampColor(0.0), smoothstep(0.7, 0.0, height) * 0.2);
    // Rising, and fading out near the top.
    float fade = smoothstep(1.0, 0.6, height);
    color = heartLayer(color, point, 7.0, 0.12, 0.5 * fade);
    color = heartLayer(color, point + 5.1, 4.5, 0.18, 0.75 * fade);
    fragColor = heartLayer(color, point + 2.3, 3.0, 0.26, 0.95 * fade);
}
`,
};

/** The code a person starts from when they edit `animation`'s shader. */
export function genGlslAnimationCode(animation: GlslAnimationType): string {
    if (animation.name === 'custom') {
        return animation.code ?? '';
    }
    return GLSL_BUILT_IN_SOURCE_MAP[animation.name];
}

/** The whole fragment shader: the helpers, the person's code, the frame. */
export function assembleGlslFragmentSource(code: string): string {
    return `${GLSL_HEADER_SOURCE}\n${code}\n${GLSL_FOOTER_SOURCE}`;
}

/**
 * How many lines the header adds above a person's code, so a compile error
 * can be told by the line THEY see.
 */
export const GLSL_HEADER_LINE_COUNT = GLSL_HEADER_SOURCE.split('\n').length;

/** A driver's error log with its line numbers moved onto the person's code. */
export function toGlslCodeErrorLog(log: string): string {
    // Some drivers end their log with a NUL.
    return log
        .replaceAll(String.fromCodePoint(0), '')
        .replace(/ERROR:\s*(\d+):(\d+):/g, (_, file: string, line: string) => {
            const codeLine = Number.parseInt(line, 10) - GLSL_HEADER_LINE_COUNT;
            return codeLine > 0
                ? `ERROR: line ${codeLine}:`
                : `ERROR: ${file}:${line}:`;
        })
        .trim();
}
