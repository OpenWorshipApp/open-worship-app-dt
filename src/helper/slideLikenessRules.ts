/**
 * How alike two pictures of one slide are (2026-11-20, `EC-763`): a
 * PowerPoint slide as the app previews it, and the slide document made from
 * it. The figure is the structural similarity index (SSIM) of their
 * brightness -- 1 for the same picture, lower as shapes, words and edges
 * differ -- the measure image comparison uses because a pixel-by-pixel
 * difference calls a slide shifted by one pixel unlike, and a blurred one
 * alike. Pure: the caller draws both pictures at one small size first.
 */

// The constants of Wang et al. (2004) for 8-bit pictures.
const SSIM_C1 = (0.01 * 255) ** 2;
const SSIM_C2 = (0.03 * 255) ** 2;

/** Each pixel's brightness (Rec. 601), from RGBA bytes. */
export function toLumaPlane(
    rgba: ArrayLike<number>,
    width: number,
    height: number,
) {
    const plane = new Float32Array(width * height);
    for (let index = 0; index < plane.length; index += 1) {
        const offset = index * 4;
        plane[index] =
            0.299 * rgba[offset] +
            0.587 * rgba[offset + 1] +
            0.114 * rgba[offset + 2];
    }
    return plane;
}

/**
 * The mean SSIM over square windows of `windowSize` pixels, `step` apart.
 * 1 for two equal pictures; a window of one flat colour against the same
 * colour counts as alike.
 */
export function computeSsim(
    first: Float32Array,
    second: Float32Array,
    width: number,
    height: number,
    windowSize = 8,
    step = 4,
) {
    if (first.length !== width * height || second.length !== first.length) {
        throw new Error('The two pictures are not the same size.');
    }
    const size = Math.min(windowSize, width, height);
    const count = size * size;
    let total = 0;
    let windowCount = 0;
    for (let top = 0; top + size <= height; top += step) {
        for (let left = 0; left + size <= width; left += step) {
            let sumA = 0;
            let sumB = 0;
            for (let y = top; y < top + size; y += 1) {
                for (let x = left; x < left + size; x += 1) {
                    sumA += first[y * width + x];
                    sumB += second[y * width + x];
                }
            }
            const meanA = sumA / count;
            const meanB = sumB / count;
            let varianceA = 0;
            let varianceB = 0;
            let covariance = 0;
            for (let y = top; y < top + size; y += 1) {
                for (let x = left; x < left + size; x += 1) {
                    const a = first[y * width + x] - meanA;
                    const b = second[y * width + x] - meanB;
                    varianceA += a * a;
                    varianceB += b * b;
                    covariance += a * b;
                }
            }
            varianceA /= count - 1 || 1;
            varianceB /= count - 1 || 1;
            covariance /= count - 1 || 1;
            total +=
                ((2 * meanA * meanB + SSIM_C1) * (2 * covariance + SSIM_C2)) /
                ((meanA * meanA + meanB * meanB + SSIM_C1) *
                    (varianceA + varianceB + SSIM_C2));
            windowCount += 1;
        }
    }
    return windowCount === 0 ? 1 : total / windowCount;
}

/**
 * Which slides to measure when not all of them are: `max` spread evenly
 * from the first to the last, each once, in order.
 */
export function pickSampleSlideNumbers(count: number, max: number) {
    if (count <= 0 || max <= 0) {
        return [];
    }
    if (count <= max) {
        return Array.from({ length: count }, (_, index) => {
            return index + 1;
        });
    }
    if (max === 1) {
        return [1];
    }
    const numberSet = new Set<number>();
    for (let index = 0; index < max; index += 1) {
        numberSet.add(1 + Math.round((index * (count - 1)) / (max - 1)));
    }
    return Array.from(numberSet).sort((a, b) => {
        return a - b;
    });
}

export type SlideLikenessScoreType = { slide: number; score: number };

/** A percentage to one decimal, as a person reads it. */
export function toLikenessPercent(score: number) {
    return Math.round(Math.max(0, Math.min(1, score)) * 1000) / 10;
}

/**
 * The deck's figure: the mean of its slides, and the least alike, which is
 * the slide worth a look.
 */
export function summarizeLikeness(scoreList: SlideLikenessScoreType[]) {
    if (scoreList.length === 0) {
        return null;
    }
    const mean =
        scoreList.reduce((sum, one) => {
            return sum + one.score;
        }, 0) / scoreList.length;
    const lowest = scoreList.reduce((low, one) => {
        return one.score < low.score ? one : low;
    });
    return {
        percent: toLikenessPercent(mean),
        lowestSlide: lowest.slide,
        lowestPercent: toLikenessPercent(lowest.score),
        measuredSlides: scoreList.map((one) => {
            return one.slide;
        }),
        slidePercents: scoreList.map((one) => {
            return { slide: one.slide, percent: toLikenessPercent(one.score) };
        }),
    };
}
