// Derived from "SMC SCAPLING" Pine v5 (LuxAlgo + DUCDC additions).
// Source snapshot SHA-256: b042e8f7d746deffb4b918828e27eab024e138767c2bbd5e5427472e13fc5cdb
// Licensed CC BY-NC-SA 4.0: https://creativecommons.org/licenses/by-nc-sa/4.0/
import { ema, highestAt, lowestAt, rsi, sma } from "./ta.js";

const truth = value => value === true;

function detectStructure(high, low, close, swingLength) {
  const size = close.length;
  const events = {
    bullBos: Array(size).fill(false), bullChoch: Array(size).fill(false),
    bearBos: Array(size).fill(false), bearChoch: Array(size).fill(false),
    bullIBos: Array(size).fill(false), bullIChoch: Array(size).fill(false),
    bearIBos: Array(size).fill(false), bearIChoch: Array(size).fill(false)
  };
  const swingState = { 5: 0, [swingLength]: 0 };
  let trend = 0, internalTrend = 0;
  let topY = 0, bottomY = 0, internalTopY = 0, internalBottomY = 0;
  let topCross = true, bottomCross = true, internalTopCross = true, internalBottomCross = true;
  let previousTopY = 0, previousBottomY = 0, previousInternalTopY = 0, previousInternalBottomY = 0;

  for (let i = 0; i < size; i += 1) {
    const swing = length => {
      if (i < length) return { top: 0, bottom: 0 };
      const old = swingState[length];
      const upper = highestAt(high, length, i);
      const lower = lowestAt(low, length, i);
      const next = high[i - length] > upper ? 0 : low[i - length] < lower ? 1 : old;
      swingState[length] = next;
      return {
        top: next === 0 && old !== 0 ? high[i - length] : 0,
        bottom: next === 1 && old !== 1 ? low[i - length] : 0
      };
    };

    const outer = swing(swingLength);
    const inner = swing(5);
    previousTopY = topY;
    previousBottomY = bottomY;
    previousInternalTopY = internalTopY;
    previousInternalBottomY = internalBottomY;
    if (outer.top) { topY = outer.top; topCross = true; }
    if (outer.bottom) { bottomY = outer.bottom; bottomCross = true; }
    if (inner.top) { internalTopY = inner.top; internalTopCross = true; }
    if (inner.bottom) { internalBottomY = inner.bottom; internalBottomCross = true; }

    const crossedOver = (level, previousLevel) => i > 0 && close[i] > level && close[i - 1] <= previousLevel;
    const crossedUnder = (level, previousLevel) => i > 0 && close[i] < level && close[i - 1] >= previousLevel;

    if (crossedOver(internalTopY, previousInternalTopY) && internalTopCross && topY !== internalTopY) {
      if (internalTrend < 0) events.bullIChoch[i] = true;
      else events.bullIBos[i] = true;
      internalTopCross = false;
      internalTrend = 1;
    }
    if (crossedOver(topY, previousTopY) && topCross) {
      if (trend < 0) events.bullChoch[i] = true;
      else events.bullBos[i] = true;
      topCross = false;
      trend = 1;
    }
    if (crossedUnder(internalBottomY, previousInternalBottomY) && internalBottomCross && bottomY !== internalBottomY) {
      if (internalTrend > 0) events.bearIChoch[i] = true;
      else events.bearIBos[i] = true;
      internalBottomCross = false;
      internalTrend = -1;
    }
    if (crossedUnder(bottomY, previousBottomY) && bottomCross) {
      if (trend > 0) events.bearChoch[i] = true;
      else events.bearBos[i] = true;
      bottomCross = false;
      trend = -1;
    }
  }
  return events;
}

export function calculateSignals(candles, settings = {}) {
  const emaFastLength = settings.emaFastLength ?? 21;
  const emaSlowLength = settings.emaSlowLength ?? 55;
  const rsiLength = settings.rsiLength ?? 14;
  const rsiFastLength = settings.rsiFastLength ?? 8;
  const swingLength = settings.swingLength ?? 50;
  const open = candles.map(x => x.open);
  const high = candles.map(x => x.high);
  const low = candles.map(x => x.low);
  const close = candles.map(x => x.close);
  const volume = candles.map(x => x.volume);
  const moment = close.map((value, i) => Math.abs(value - open[i]));
  const emaFast = ema(close, emaFastLength);
  const emaSlow = ema(close, emaSlowLength);
  const rsiMain = rsi(close, rsiLength);
  const rsiFast = rsi(close, rsiFastLength);
  const emaRsi = sma(rsiMain, rsiLength);
  const macdRsi = rsiFast.map((value, i) => Number.isFinite(value) && Number.isFinite(rsiMain[i]) ? value - rsiMain[i] : null);
  const signal = sma(macdRsi, rsiLength);
  const emaVolume20 = ema(volume, 20);
  const structure = detectStructure(high, low, close, swingLength);
  const result = [];

  const red = i => i >= 0 && close[i] < open[i];
  const green = i => i >= 0 && close[i] > open[i];
  const doji = (i, precision = 0.02) => i >= 0 && Math.abs(open[i] - close[i]) <= (high[i] - low[i]) * precision;
  const upbar = i => i > 0 && low[i] > low[i - 1] && high[i] > high[i - 1];
  const inbar = (i, parent = i - 1) => i >= 0 && parent >= 0 && close[i] >= low[parent] && close[i] <= high[parent] && open[i] >= low[parent] && open[i] <= high[parent];
  const crossOver = (a, b, i) => i > 0 && Number.isFinite(a[i]) && Number.isFinite(b[i]) && a[i] > b[i] && a[i - 1] <= b[i - 1];
  const crossUnder = (a, b, i) => i > 0 && Number.isFinite(a[i]) && Number.isFinite(b[i]) && a[i] < b[i] && a[i - 1] >= b[i - 1];
  const buyCondition = Array(candles.length).fill(false);
  const maCd2 = Array(candles.length).fill(false);
  const buy4 = Array(candles.length).fill(false);
  const buy5 = Array(candles.length).fill(false);
  const buy6 = Array(candles.length).fill(false);
  const fakeRug = Array(candles.length).fill(false);
  const sellRsi = Array(candles.length).fill(false);
  const sellPa = Array(candles.length).fill(false);
  const sellSignal = Array(candles.length).fill(false);
  const sell2 = Array(candles.length).fill(false);
  const fakeOut = Array(candles.length).fill(false);

  for (let i = 0; i < candles.length; i += 1) {
    const valid = i >= 60 && [emaFast[i], emaSlow[i], rsiMain[i], emaRsi[i], macdRsi[i], signal[i]].every(Number.isFinite);
    if (!valid) { result.push({ buyTypes: [], sellTypes: [], warnings: [], exitTypes: [], trendTypes: [] }); continue; }
    const uptrend = emaFast[i] > emaSlow[i];
    const downtrend = emaFast[i] < emaSlow[i];
    const c1 = red(i - 1) && green(i) && volume[i] > volume[i - 1] && open[i - 2] < emaFast[i - 2] && moment[i - 1] > 2 * moment[i] && downtrend && low[i] < lowestAt(low, 10, i - 1) && moment[i] < (high[i] - low[i]) / 3.5 && !doji(i);
    const c2 = green(i - 1) && high[i] > high[i - 1] && low[i] < low[i - 1] && low[i] < lowestAt(low, 3, i - 1) && high[i] > highestAt(high, 2, i - 1) && open[i] < emaFast[i] && moment[i] * 0.5 < Math.min(open[i], close[i]) - low[i] && (rsiMain[i] < emaRsi[i] || rsiMain[i - 1] > emaRsi[i - 1]) && !doji(i, 0.08);
    const c3 = red(i - 1) && high[i] > high[i - 1] && rsiMain[i - 1] < 45 && low[i - 1] < lowestAt(low, 20, i - 2) && ((close[i] - open[i]) > (open[i] - low[i]) || low[i] < lowestAt(low, 20, i - 1)) && emaRsi[i - 1] < 45 && green(i) && rsiMain[i] > emaRsi[i];
    const c4 = red(i) && rsiMain[i] < emaRsi[i] && moment[i] < (high[i] - low[i]) / 7 && volume[i] > volume[i - 1] && low[i] < lowestAt(low, 7, i - 1) && moment[i] / open[i] < 0.005 && red(i - 1) && 8 * moment[i] < moment[i - 1];
    const buyVol = close[i] > (open[i - 1] + close[i - 1]) / 2 && close[i - 1] < close[i - 2] && red(i - 2) && green(i) && close[i - 2] < emaFast[i - 2] && volume[i - 2] < volume[i - 1] && volume[i] < volume[i - 1] && (low[i - 1] < lowestAt(low, 14, i - 2) || low[i] < lowestAt(low, 14, i - 1)) && !doji(i, 0.03) && highestAt(high, 6, i) < highestAt(emaFast, 6, i);
    const maCd21 = macdRsi[i - 1] < signal[i - 1] && macdRsi[i - 2] < signal[i - 2] && macdRsi[i - 3] < signal[i - 3] && [2, 3, 4, 5].every(k => macdRsi[i - k] < 0);
    const maCdRsi = (uptrend && emaRsi[i] > 50) || (downtrend && emaRsi[i] < 42);
    maCd2[i] = (green(i) && macdRsi[i] > signal[i] && red(i - 1) && moment[i] > moment[i - 1] && !doji(i, 0.1) && maCd21 && maCdRsi) || (doji(i, 0.05) && rsiMain[i] < 30 && high[i] - low[i] >= moment[i - 1]);
    const c6 = red(i - 1) && red(i - 2) && green(i) && close[i - 1] > low[i - 2] && low[i - 2] < low[i - 1] && close[i - 1] < emaFast[i - 1];
    // Pine c5[1] is recomputed explicitly because c5 is local to this loop.
    const previousC5 = i > 0 && volume[i - 1] > emaVolume20[i - 1] && high[i - 1] < emaFast[i - 1] && open[i - 1] - low[i - 1] > 3 * (open[i - 1] - close[i - 1]) && volume[i - 1] > volume[i - 2] && close[i - 2] < open[i - 2] && low[i - 1] < lowestAt(low, 10, i - 2) && close[i - 1] < open[i - 1] && rsiMain[i - 1] < 30;
    buyCondition[i] = ((c1 || c3 || c4) && macdRsi[i] > signal[i] && rsiMain[i - 1] < 35 && !doji(i, 0.1)) || (c2 && rsiMain[i] < 35) || ((previousC5 && green(i) || buyVol || c6) && rsiMain[i] < 35 && !doji(i, 0.1));
    buy4[i] = open[i - 2] > emaFast[i] && close[i - 1] < emaFast[i] && green(i) && green(i - 2) && green(i - 3) && moment[i - 1] > moment[i] && !doji(i, 0.2);
    buy5[i] = uptrend && (green(i - 2) || doji(i - 2, 0.1)) && red(i - 1) && green(i) && moment[i] > moment[i - 1] && moment[i - 1] > moment[i - 2] && open[i - 1] < emaFast[i] && red(i - 3) && low[i - 1] < low[i - 2];
    buy6[i] = (doji(i, 0.2) && [i, i - 1, i - 2, i - 3].some(j => truth(maCd2[j])) && red(i - 1)) || ((truth(structure.bearBos[i - 1]) || truth(structure.bearIBos[i - 1])) && green(i) && red(i - 1) && rsiMain[i - 1] < 30);
    sellRsi[i] = !doji(i - 1, 0.5) && close[i - 1] > highestAt(close, 20, i - 2) && low[i] < low[i - 1] && high[i] < high[i - 1] * 1.1 && red(i) && emaFast[i] > emaSlow[i] && close[i] < open[i - 1];
    const s1 = green(i - 2) && green(i - 1) && red(i) && moment[i] > 2 * moment[i - 1] && high[i - 1] > emaFast[i - 1];
    const s2 = green(i - 2) && green(i - 1) && green(i) && high[i] - close[i] > close[i] - open[i] && volume[i] > volume[i - 1] && uptrend && open[i] - low[i] < close[i] - open[i];
    sellSignal[i] = s1 || s2;
    sellPa[i] = red(i - 2) && green(i - 1) && red(i) && (high[i] >= highestAt(high, 15, i) || high[i - 1] >= highestAt(high, 15, i)) && moment[i - 1] > moment[i - 2] * 2 && moment[i] < moment[i - 1] / 1.5 && upbar(i - 2);
    sell2[i] = green(i - 3) && green(i - 2) && green(i - 1) && red(i) && low[i] < open[i - 1] && !doji(i - 1, 0.2) && ((open[i] > emaFast[i] && close[i] > emaFast[i]) || open[i] < emaFast[i]) && upbar(i - 1);
    fakeOut[i] = (truth(structure.bullBos[i - 1]) || truth(structure.bullIBos[i - 1]) || truth(structure.bullChoch[i - 1]) || truth(structure.bullIChoch[i - 1])) && red(i) && (high[i] >= highestAt(high, 20, i) || high[i - 1] >= highestAt(high, 20, i));
    const fakeRug1 = (truth(sell2[i - 1]) && downtrend && close[i - 1] < emaFast[i] && green(i)) || (truth(structure.bearIChoch[i - 1]) && green(i) && moment[i] > moment[i - 1]);
    fakeRug[i] = ((truth(structure.bearIChoch[i - 1]) || truth(structure.bearChoch[i - 1])) && green(i) && !doji(i, 0.1) && (green(i - 2) || green(i - 3))) || fakeRug1;
    const bottomM = red(i - 1) && green(i) && green(i - 2) && crossOver(macdRsi, signal, i) && !doji(i, 0.1) && low[i - 1] === lowestAt(low, 10, i) && moment[i - 1] > moment[i - 2];
    const inside = inbar(i - 3) && inbar(i - 2) && inbar(i - 1) && inbar(i - 1, i - 3) && Math.min(low[i - 3], low[i - 1], low[i - 2]) === lowestAt(low, 10, i) && red(i - 3) && red(i - 2) && red(i - 1) && green(i) && moment[i] > moment[i - 1];
    const testLong = low[i] === lowestAt(low, 5, i) && moment[i] > moment[i - 1] && open[i] - low[i] > moment[i] && red(i - 1) && green(i) && !doji(i, 0.1);
    const testLong1 = uptrend && red(i - 1) && red(i - 2) && green(i) && high[i - 1] < high[i - 2] && low[i - 1] > low[i - 2] && !doji(i - 1, 0.01) && close[i - 1] < emaFast[i - 1];
    const testLong2 = inbar(i - 1) && red(i - 1) && green(i) && green(i - 2) && close[i] < emaFast[i] && Math.min(low[i], low[i - 1], low[i - 2]) === lowestAt(low, 10, i) && highestAt(high, 10, i) < highestAt(emaFast, 10, i);
    const testLong3 = uptrend && red(i - 1) && green(i) && ([1, 2, 3].some(offset => emaFast[i - offset] < emaSlow[i - offset]));
    const shiftedCloseCrossOverEma = i > 1 && close[i - 1] > emaFast[i] && close[i - 2] <= emaFast[i - 1];
    const testShort = inbar(i) && green(i - 2) && green(i - 1) && red(i) && shiftedCloseCrossOverEma && crossUnder(close, emaFast, i) && low[i] < low[i - 1];
    const exitLong = close[i] > emaFast[i] && high[i - 1] >= highestAt(high, 10, i) && red(i) && green(i - 1) && close[i] < open[i - 1] && moment[i] > 1.2 * moment[i - 1] && !doji(i, 0.1);
    const exitShort = close[i] < emaFast[i] && low[i - 1] <= lowestAt(low, 20, i) && green(i) && red(i - 1) && close[i] > open[i - 1] && moment[i] > 1.2 * moment[i - 1] && !doji(i, 0.1);
    const uptrendCross = crossOver(emaFast, emaSlow, i);
    const downtrendCross = crossUnder(emaFast, emaSlow, i);
    const weakhand = uptrend && green(i - 1) && red(i) && green(i - 2) && close[i] < lowestAt(open, 5, i) && close[i - 1] > open[i - 2] && low[i - 1] > emaFast[i - 1] && !doji(i - 1, 0.05) && close[i - 10] < emaFast[i - 10];
    const buys = [];
    if (buy6[i] && !buy6[i - 1]) buys.push("B6");
    if (buy4[i]) buys.push("B4");
    if (buy5[i]) buys.push("B5");
    if (buyCondition[i] && !buyCondition[i - 1]) buys.push("B");
    if (maCd2[i] && !maCd2[i - 1]) buys.push("BB");
    if (fakeRug[i]) buys.push("FR");
    if (bottomM) buys.push("BOTTOM");
    if (inside) buys.push("IN");
    if (testLong) buys.push("TL");
    if (testLong1) buys.push("TL1");
    if (testLong2) buys.push("TL2");
    const sells = [];
    if (sellRsi[i] && !sellPa[i - 1] && !sellSignal[i - 1] && !sellRsi[i - 1]) sells.push("SS");
    if (sellPa[i] && !sellRsi[i - 1] && !sellSignal[i - 1] && !sellPa[i - 1]) sells.push("SA");
    if (sellSignal[i] && !sellRsi[i - 1] && !sellPa[i - 1] && !sellSignal[i - 1]) sells.push("SSO");
    if (sell2[i] && !sellRsi[i - 1] && !sellPa[i - 1] && !sellSignal[i - 1]) sells.push("S2");
    if (fakeOut[i]) sells.push("FO");
    if (testShort) sells.push("TS");
    const warnings = weakhand || fakeRug[i] || testLong3 ? ["R"] : [];
    const exitTypes = [exitLong ? "EXT_LONG" : null, exitShort ? "EXT_SHORT" : null].filter(Boolean);
    const trendTypes = [uptrendCross ? "EMA_UP" : null, downtrendCross ? "EMA_DOWN" : null].filter(Boolean);
    result.push({ buyTypes: buys, sellTypes: sells, warnings, exitTypes, trendTypes });
  }
  return result;
}
