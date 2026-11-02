// Timekeeper-only messages; Wand runtime/registry/preference are copied exactly
// from DreamwishWand/web@71e568c... and do not bring Wand's site shell.
import {translate} from '../../../i18n.mjs';
const legacy={en:'en-US',fr:'fr',it:'it',de:'de','es-ES':'es',ja:'ja','zh-CN':'zh-CN','pt-BR':'pt-BR'};
const keys=['tab_spawn','tab_resources','tab_shops','tab_daily','backup','opened','all','allRegions','selected','recordCount','noRecords','selectVisible','clearSelection','unselected','planCount','planEmpty','undo','redo','clear','stagePreview','timeZone','imagesUnavailable','pairPrepare','pairBoth','pairRetryOriginal','pairRetryEdited','pairConfirmBuild','pairReady','pairPrepareFailed','pairWarning','pairRequested','pairBlocked','pairNotAttempted','pairBothStatus','selectPrompt','timeStored','previewTime','needsTime','planUpdated','planFail','preflightFailed'];
const extra={
 en:{'tk.title':'Dreamlight Timekeeper','tk.open':'Open save','tk.again':'Open another save','tk.drop':'Drop a local P1G or JSON save','tk.search':'Search item / EventID','tk.region':'Region','tk.category':'Category','tk.item':'Item','tk.select':'Select visible','tk.deselect':'Clear selection','tk.more':'Load more','tk.preview':'Date preview','tk.diagnostics':'Diagnostics','tk.details':'Details','tk.custom':'Custom','tk.confirm':'Confirm this is Nintendo Switch DDV v1.25.3 (BID 9A239D3DB569756D)','tk.invalid':'Invalid or ambiguous local time (DST)','tk.loading':'Reading save locally','tk.ready':'Save opened locally','tk.original':'Original backup','tk.none':'No records','tk.manual':'Language','tk.saveState':'Download requested, save not confirmed','tk.request':'Request original, then edited copy','tk.edit':'Prepare verified edited P1G','tk.showMore':'Show more','tk.filter':'Filter','tk.notice':'Unofficial fan-made tool. Not affiliated with Disney or Gameloft. No game-image rights claimed.','tk.resetLocale':'Use browser language'},
 ja:{'tk.title':'Dreamlight Timekeeper','tk.open':'セーブを開く','tk.again':'別のセーブを開く','tk.drop':'ローカルのP1G／JSONをドロップ','tk.search':'アイテム名・EventIDで検索','tk.region':'エリア','tk.category':'カテゴリ','tk.item':'アイテム','tk.select':'表示中を一括選択','tk.deselect':'選択解除','tk.more':'さらに表示','tk.preview':'日時プレビュー','tk.diagnostics':'診断情報','tk.details':'詳細','tk.custom':'任意日時','tk.confirm':'Nintendo Switch版 DDV v1.25.3（BID 9A239D3DB569756D）と確認','tk.invalid':'存在しない、またはDSTで曖昧なローカル日時','tk.loading':'ローカルでセーブ解析中','tk.ready':'セーブを読み込みました','tk.original':'原本をバックアップ','tk.none':'該当データなし','tk.manual':'言語','tk.saveState':'ダウンロード要求済み・保存完了は未確認','tk.request':'原本→編集済みコピーの順に要求','tk.edit':'検証済み編集P1Gを準備','tk.showMore':'さらに表示','tk.filter':'絞り込み','tk.notice':'非公式のファン制作ツールです。Disney/Gameloftとは無関係です。ゲーム画像の権利は主張しません。','tk.resetLocale':'ブラウザーの言語に戻す'}
};
const codes=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
export const catalogs=Object.freeze(Object.fromEntries(codes.map(code=>{
 const out={...extra.en,...(extra[code]||{})};
 for(const key of keys){
  const legacyCode=legacy[code];
  const value=translate(legacyCode,key);
  const fallback=translate('en-US',key);
  out['tk.'+key]=value===key?(fallback===key?key:fallback):value;
 }
 return [code,Object.freeze(out)];
})));
