import {beforeEach,describe,expect,it,vi} from "vitest";
import {getDrawingToolFavorites,setDrawingToolFavorite} from "../pages/trading/drawingToolFavorites";

describe("drawing tool favorites",()=>{
  beforeEach(()=>localStorage.clear());
  it("persists favorite tools without duplicates",()=>{
    const listener=vi.fn();
    window.addEventListener("opencharts:drawing-tool-favorites",listener);
    setDrawingToolFavorite("text",true);
    setDrawingToolFavorite("text",true);
    expect(getDrawingToolFavorites()).toEqual(["text"]);
    setDrawingToolFavorite("text",false);
    expect(getDrawingToolFavorites()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(3);
    window.removeEventListener("opencharts:drawing-tool-favorites",listener);
  });
});
