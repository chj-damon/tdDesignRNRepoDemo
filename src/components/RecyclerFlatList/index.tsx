import { Box, Empty, helpers } from '@td-design/react-native';
import { useCreation } from '@td-design/rn-hooks';
import { ForwardedRef, forwardRef, ReactNode, ReactText, useRef } from 'react';
import { ScrollView, ScrollViewProps } from 'react-native';
import {
  DataProvider,
  Dimension,
  Layout,
  LayoutProvider,
  RecyclerListView,
  RecyclerListViewProps,
} from 'recyclerlistview';

export interface RecyclerListViewRef<T> {
  scrollToIndex(index: number, animate?: boolean): void;
  scrollToItem(data: T, animate?: boolean): void;
  getLayout(index: number): Layout | undefined;
  scrollToTop(animate?: boolean): void;
  scrollToEnd(animate?: boolean): void;
  scrollToOffset: (x: number, y: number, animate?: boolean) => void;
  updateRenderAheadOffset(renderAheadOffset: number): boolean;
  getCurrentRenderAheadOffset(): number;
  getCurrentScrollOffset(): number;
  findApproxFirstVisibleIndex(): number;
  getRenderedSize(): Dimension;
  getContentDimension(): Dimension;
  forceRerender(): void;
  renderCompat(): JSX.Element;
}
export interface RenderItemInfo<T> {
  type: ReactText;
  item: T;
  index: number;
}
export interface RecyclerFlatListProps<T>
  extends Partial<
    Pick<
      RecyclerListViewProps,
      | 'renderFooter'
      | 'onEndReached'
      | 'onEndReachedThreshold'
      | 'onScroll'
      | 'renderAheadOffset'
      | 'initialOffset'
      | 'initialRenderIndex'
    >
  > {
  data: T[];
  itemHeight: number;
  headerHeight?: number;
  marginHorizontal?: number;
  gap?: number;
  numColumns?: number;
  keyExtractor: (item: T) => string;
  renderHeader?: () => JSX.Element;
  renderItem: (info: RenderItemInfo<T>) => JSX.Element;
  scrollViewProps?: ScrollViewProps;
  emptyComponent?: ReactNode;
}

const ViewTypes = {
  HEADER: 'HEADER',
  ITEM: 'ITEM',
};

function RecyclerFlatListInner<
  T extends { isCrossRow?: boolean } & Record<string, unknown>,
  R = RecyclerListViewRef<T>
>(
  {
    data,
    headerHeight = 0,
    itemHeight,
    keyExtractor,
    renderItem,
    renderHeader,
    renderFooter,
    onEndReached,
    onEndReachedThreshold = 20,
    initialOffset,
    initialRenderIndex,
    scrollViewProps,
    onScroll,
    renderAheadOffset = helpers.deviceHeight,
    numColumns = 1,
    gap = 0,
    marginHorizontal = 0,
    emptyComponent,
  }: RecyclerFlatListProps<T>,
  ref: ForwardedRef<R>
) {
  const scrollViewRef = useRef<ScrollView>();

  /**
   * ??????????????????????????????
   * header????????????????????????
   * ?????????????????????????????????????????????
   */
  const getItemWidth = (type: string | number, isCrossRow = false) => {
    const containerWidth = getContainerWidth(marginHorizontal);
    if (type === ViewTypes.HEADER || isCrossRow) {
      return containerWidth;
    }
    return containerWidth / numColumns;
  };

  /** ???????????????????????? */
  const getRowDimensions = (type: ReactText, index: number) => {
    const item = listData.getDataForIndex(index);
    const isCrossRow = item.isCrossRow ?? false;
    return {
      width: getItemWidth(type, isCrossRow),
      height: item.height || itemHeight,
    };
  };

  /**
   * RLV ?????????DataProvider
   */
  const dataProvider = new DataProvider((r1: T, r2: T) => {
    const key1 = keyExtractor(r1);
    const key2 = keyExtractor(r2);
    return key1 !== key2;
  });
  const listData = dataProvider.cloneWithRows(data);

  /**
   * RLV ?????????LayoutProvider
   */
  const layoutProvider = new LayoutProvider(
    index => {
      if (index === 0) return ViewTypes.HEADER;

      const item = listData.getDataForIndex(index);
      if (item.height) return item.height;

      return ViewTypes.ITEM;
    },
    (type, dim, index) => {
      const item = listData.getDataForIndex(index);
      const isCrossRow = item.isCrossRow ?? false;
      const itemWidth = getItemWidth(type, isCrossRow);
      if (item.height) {
        dim.width = itemWidth;
        dim.height = item.height;
        return;
      }

      switch (type) {
        case ViewTypes.HEADER:
          dim.width = itemWidth;
          dim.height = headerHeight;
          break;

        case ViewTypes.ITEM:
          dim.width = itemWidth;
          dim.height = itemHeight;
          break;

        default:
          dim.width = 0;
          dim.height = 0;
      }
    }
  );

  /**
   * RLV ?????????RowRenderer
   */
  const rowRenderer = (type: ReactText, item: T, index: number) => {
    if (type === ViewTypes.HEADER) return renderHeader ? renderHeader() : null;

    const preData = listData.getAllData().slice(0, index);
    const preCrossCount = preData.filter(_ => _.isCrossRow).length || 0;

    // ?????????????????????Android ???????????????????????? ios ??????????????????????????????????????????
    const { width = 0, height = 0 } = getRowDimensions(type, index);
    let paddingLeft = gap / numColumns;
    let paddingRight = gap / numColumns;

    // ?????????????????????????????? gap ??????????????????????????? item ??? row ????????????????????????????????????????????????
    const curIndex = index - preCrossCount;
    const isRowStart = curIndex % numColumns === 1;
    const isRowEnd = curIndex % numColumns === 0;
    const isRowMiddle = !isRowStart && !isRowEnd;

    if (isRowStart) {
      paddingLeft = 0;
      paddingRight = gap / 2;
    }

    if (isRowEnd) {
      paddingLeft = gap / 2;
      paddingRight = 0;
    }
    if (isRowMiddle) {
      paddingLeft = gap / 2;
      paddingRight = gap / 2;
    }

    if (item.isCrossRow) {
      paddingLeft = 0;
      paddingRight = 0;
    }

    return (
      <Box overflow="hidden" width={width} height={height}>
        <Box
          flex={1}
          style={{
            paddingLeft,
            paddingRight,
            paddingTop: gap,
          }}
        >
          {renderItem({ type, item, index })}
        </Box>
      </Box>
    );
  };

  const contentContainerStyle = useCreation(() => {
    if (scrollViewProps && scrollViewProps.contentContainerStyle) {
      return Object.assign(scrollViewProps.contentContainerStyle, { marginHorizontal });
    }
    return {
      marginHorizontal,
    };
  }, []);

  if (data.length === 0) {
    return (
      <ScrollView
        ref={ref as ForwardedRef<ScrollView>}
        {...scrollViewProps}
        contentContainerStyle={[{ flex: 1 }, scrollViewProps?.contentContainerStyle]}
      >
        {emptyComponent ?? <Empty />}
      </ScrollView>
    );
  }

  return (
    <RecyclerListView
      ref={ref as any}
      dataProvider={listData}
      layoutProvider={layoutProvider}
      rowRenderer={rowRenderer}
      renderFooter={renderFooter}
      onEndReached={onEndReached}
      onEndReachedThreshold={onEndReachedThreshold}
      canChangeSize
      initialOffset={initialOffset}
      onScroll={onScroll}
      scrollViewProps={{
        ref: scrollViewRef,
        ...scrollViewProps,
        contentContainerStyle,
      }}
      {...(initialRenderIndex && !!data.length ? { initialRenderIndex } : {})}
      scrollThrottle={16}
      // https://github.com/Flipkart/recyclerlistview/tree/master/docs/guides/performance
      renderAheadOffset={renderAheadOffset}
      optimizeForInsertDeleteAnimations
    />
  );
}

/** ???????????????????????????forwardRef???????????????????????? */
export const RecyclerFlatList = forwardRef(RecyclerFlatListInner) as <T, R = RecyclerListViewRef<T>>(
  props: RecyclerFlatListProps<T> & { ref?: React.ForwardedRef<R> }
) => ReturnType<typeof RecyclerFlatListInner>;

/**
 * To deal with precision issues on android
 * Adjustment for margin given to RLV;
 */
function getContainerWidth(margin = 0) {
  return Math.round(helpers.deviceWidth * 1000) / 1000 - margin * 2;
}
