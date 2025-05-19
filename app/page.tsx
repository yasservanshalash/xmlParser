'use client'
import { useState, useEffect, ReactElement } from "react";
// Import DevExtreme components
import { Chart, Series, Legend, ValueAxis, Export, Title } from 'devextreme-react/chart';
import { PieChart, Series as PieSeries } from 'devextreme-react/pie-chart';
import { PivotGrid, FieldChooser } from 'devextreme-react/pivot-grid';
import PivotGridDataSource from 'devextreme/ui/pivot_grid/data_source';
import 'devextreme/dist/css/dx.light.css';
import FinancialData from "@/public/data.json";

// Import types from DevExtreme
import { SeriesType } from 'devextreme/viz/chart';

// Define type for financial data items
type FinancialRecord = {
  CompGroupId: string;
  DocDt: string;
  GLCode: string;
  ACCCompId: string;
  Amount: string;
};

// Define type for chart data structures
type ChartConfig = {
  $?: {
    Name?: string;
    Type?: string;
    ValueAxisTitle?: string;
    Rotated?: string;
    ComponentName?: string;
    [key: string]: unknown;
  };
  data?: unknown[];
  Panes?: {
    Pane?: {
      $?: { Name?: string };
      Series?: {
        Simple?: {
          $?: { SeriesType?: string };
          Value?: unknown[];
        }[];
      }[];
    }[];
  }[];
  [key: string]: unknown;
};

type DashboardData = {
  Chart?: ChartConfig[];
  Pie?: ChartConfig[];
  Pivot?: ChartConfig[];
  [key: string]: unknown;
};

// Define types for layout information
type LayoutItem = {
  $?: {
    DashboardItem?: string;
    Weight?: string;
  };
};

type LayoutGroup = {
  $?: {
    Orientation?: string;
    Weight?: string;
  };
  LayoutItem?: LayoutItem[];
  LayoutGroup?: LayoutGroup[];
};

// Define types for API response
type ApiResponse = {
  Dashboard?: {
    Items?: DashboardData[];
    LayoutTree?: {
      LayoutGroup?: LayoutGroup[];
    }[];
  };
};

// Define types for processed data
type ChartDataItem = {
  argument: string;
  value: number;
};

type ProcessedData = {
  byGLCode: ChartDataItem[];
  byCompGroup: ChartDataItem[];
  byACCCompId: ChartDataItem[];
  byMonthYear: Record<string, Record<string, number>>;
  rawData: FinancialRecord[];
};

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [layoutTree, setLayoutTree] = useState<{ LayoutGroup?: LayoutGroup[] } | null>(null);
  
  // Define the specific order for CompGroupId values
  const compGroupOrder = ["ASP", "OTH", "PC", "RMX"];
  
  // Process financial data
  useEffect(() => {
    try {
      console.log("Processing financial data:", FinancialData.length, "records");
      
      // Group data by GLCode
      const glCodeTotals = FinancialData.reduce((acc: Record<string, number>, item: FinancialRecord) => {
        const glCode = item.GLCode;
        const amount = parseFloat(item.Amount);
        
        if (!isNaN(amount)) {
          if (!acc[glCode]) {
            acc[glCode] = 0;
          }
          acc[glCode] += amount;
        }
        
        return acc;
      }, {});
      
      // Convert to array format for Chart
      const byGLCode = Object.keys(glCodeTotals).map(glCode => ({
        argument: glCode,
        value: glCodeTotals[glCode]
      })).sort((a, b) => b.value - a.value);
      
      // Group data by CompGroupId
      const compGroupTotals = FinancialData.reduce((acc: Record<string, number>, item: FinancialRecord) => {
        const compGroup = item.CompGroupId;
        const amount = parseFloat(item.Amount);
        
        if (!isNaN(amount)) {
          if (!acc[compGroup]) {
            acc[compGroup] = 0;
          }
          acc[compGroup] += amount;
        }
        
        return acc;
      }, {});
      
      // Convert to array format with specific order
      const byCompGroup = compGroupOrder
        .filter(compGroup => compGroupTotals[compGroup] !== undefined)
        .map(compGroup => ({
          argument: compGroup,
          value: compGroupTotals[compGroup]
        }));
      
      // Add any other CompGroupIds that might not be in the predefined order
      Object.keys(compGroupTotals)
        .filter(compGroup => !compGroupOrder.includes(compGroup))
        .forEach(compGroup => {
          byCompGroup.push({
            argument: compGroup,
            value: compGroupTotals[compGroup]
          });
        });
      
      // Group data by ACCCompId
      const accCompTotals = FinancialData.reduce((acc: Record<string, number>, item: FinancialRecord) => {
        const accCompId = item.ACCCompId;
        const amount = parseFloat(item.Amount);
        
        if (!isNaN(amount)) {
          if (!acc[accCompId]) {
            acc[accCompId] = 0;
          }
          acc[accCompId] += amount;
        }
        
        return acc;
      }, {});
      
      // Convert to array format
      const byACCCompId = Object.keys(accCompTotals).map(accCompId => ({
        argument: accCompId,
        value: accCompTotals[accCompId]
      })).sort((a, b) => b.value - a.value);
      
      // Process data by month and year
      const byMonthYear: Record<string, Record<string, number>> = {};
      
      FinancialData.forEach((item: FinancialRecord) => {
        const amount = parseFloat(item.Amount);
        if (isNaN(amount)) return;
        
        const date = new Date(item.DocDt);
        if (isNaN(date.getTime())) return;
        
        const year = date.getFullYear().toString();
        const month = date.toLocaleString('default', { month: 'short' });
        
        if (!byMonthYear[year]) {
          byMonthYear[year] = {};
        }
        
        if (!byMonthYear[year][month]) {
          byMonthYear[year][month] = 0;
        }
        
        byMonthYear[year][month] += amount;
      });
      
      setProcessedData({
        byGLCode,
        byCompGroup,
        byACCCompId,
        byMonthYear,
        rawData: FinancialData
      });
    } catch (err) {
      console.error('Error processing financial data:', err);
      setError("Failed to process financial data");
    }
  }, []);
  
  // Fetch chart configuration from API
  useEffect(() => {
    setLoading(true);
    fetch('/api/parse-xml')
      .then((res) => res.json())
      .then((data: ApiResponse) => {
        console.log("Raw API response:", data);
        // Check if data has the expected structure
        if (data && data.Dashboard && data.Dashboard.Items) {
          setDashboardData(data.Dashboard.Items[0]);
          
          // Store the layout tree for dynamic rendering
          if (data.Dashboard.LayoutTree && data.Dashboard.LayoutTree[0]) {
            console.log("Layout tree found:", data.Dashboard.LayoutTree[0]);
            setLayoutTree(data.Dashboard.LayoutTree[0]);
          } else {
            console.warn("Layout information not found in XML");
          }
        } else {
          console.error("Unexpected data structure:", data);
          setError("Unexpected data structure received from API");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Fetch error:', err);
        setError("Failed to fetch data");
        setLoading(false);
      });
  }, []);

  // Function to extract series type from chart configuration
  const getSeriesType = (chart: ChartConfig): SeriesType => {
    try {
      // Try to extract series type from the Panes structure
      if (chart.Panes && 
          Array.isArray(chart.Panes) && 
          chart.Panes[0] && 
          chart.Panes[0].Pane && 
          Array.isArray(chart.Panes[0].Pane) && 
          chart.Panes[0].Pane[0] && 
          chart.Panes[0].Pane[0].Series && 
          Array.isArray(chart.Panes[0].Pane[0].Series) && 
          chart.Panes[0].Pane[0].Series[0] && 
          chart.Panes[0].Pane[0].Series[0].Simple && 
          Array.isArray(chart.Panes[0].Pane[0].Series[0].Simple) && 
          chart.Panes[0].Pane[0].Series[0].Simple[0] && 
          chart.Panes[0].Pane[0].Series[0].Simple[0].$ && 
          chart.Panes[0].Pane[0].Series[0].Simple[0].$.SeriesType) {
        
        const seriesType = chart.Panes[0].Pane[0].Series[0].Simple[0].$.SeriesType.toLowerCase();
        console.log("Found series type in configuration:", seriesType);
        
        // Map the XML series type to a valid DevExtreme series type
        switch (seriesType) {
          case 'spline':
            return 'spline';
          case 'line':
            return 'line';
          case 'bar':
            return 'bar';
          case 'area':
            return 'area';
          case 'stackedbar':
            return 'stackedbar';
          case 'fullstackedbar':
            return 'fullstackedbar';
          default:
            return 'bar';
        }
      }
    } catch (error) {
      console.error("Error extracting series type:", error);
    }
    
    // If we can't find the series type or there's an error, use a default
    return chart.$ && chart.$.Type ? 
      (chart.$.Type.toLowerCase() === 'spline' ? 'spline' : 'bar') : 'bar';
  };

  // Function to create a component by its type and component name
  const createComponent = (componentName: string): ReactElement | null => {
    if (!dashboardData || !processedData) return null;
    
    // Find the chart configuration by component name
    let componentConfig: ChartConfig | undefined;
    let componentType: string | undefined;
    
    // Check in charts
    if (dashboardData.Chart && Array.isArray(dashboardData.Chart)) {
      const chart = dashboardData.Chart.find(c => c.$ && c.$.ComponentName === componentName);
      if (chart) {
        componentConfig = chart;
        componentType = 'Chart';
      }
    }
    
    // Check in pie charts
    if (!componentConfig && dashboardData.Pie && Array.isArray(dashboardData.Pie)) {
      const pie = dashboardData.Pie.find(p => p.$ && p.$.ComponentName === componentName);
      if (pie) {
        componentConfig = pie;
        componentType = 'Pie';
      }
    }
    
    // Check in pivot grids
    if (!componentConfig && dashboardData.Pivot && Array.isArray(dashboardData.Pivot)) {
      const pivot = dashboardData.Pivot.find(p => p.$ && p.$.ComponentName === componentName);
      if (pivot) {
        componentConfig = pivot;
        componentType = 'Pivot';
      }
    }
    
    if (!componentConfig || !componentType) {
      console.warn(`Component ${componentName} not found in dashboard data`);
      return null;
    }
    
    // Create the component based on its type
    const config = componentConfig.$ || {};
    
    switch (componentType) {
      case 'Chart': {
        let chartData;
        const seriesType = getSeriesType(componentConfig);
        
        // Determine which data to use based on chart name
        if (config.Name?.includes("Revenue By Year Division")) {
          chartData = processedData.byCompGroup;
        } else if (config.Name?.includes("Periodic Revenue")) {
          // Convert month-year data to series format
          const lineChartData: ChartDataItem[] = [];
          Object.keys(processedData.byMonthYear).forEach(year => {
            Object.keys(processedData.byMonthYear[year]).forEach(month => {
              lineChartData.push({
                argument: `${month} ${year}`,
                value: processedData.byMonthYear[year][month]
              });
            });
          });
          chartData = lineChartData;
        } else {
          // Default to GL Code data
          chartData = processedData.byGLCode.slice(0, 10);
        }
        
        return (
          <div className="border rounded shadow-md h-full" key={componentName}>
            <Chart
              id={componentName}
              dataSource={chartData}
              palette="Harmony Light"
              rotated={config.Rotated === 'true'}
            >
              <Title text={config.Name || 'Chart'} />
              <Legend visible={true} />
              <Series
                valueField="value"
                argumentField="argument"
                type={seriesType}
                name={config.Name || 'Data Series'}
              />
              <ValueAxis title={{ text: config.ValueAxisTitle || 'Amount' }} />
              <Export enabled={true} />
            </Chart>
          </div>
        );
      }
      
      case 'Pie': {
        return (
          <div className="border rounded shadow-md h-full" key={componentName}>
            <PieChart
              id={componentName}
              dataSource={processedData.byCompGroup}
              palette="Bright"
              title={config.Name || 'Company Distribution'}
              resolveLabelOverlapping="shift"
            >
              <PieSeries
                argumentField="argument"
                valueField="value"
              />
              <Legend visible={true} margin={{ top: 20 }} />
              <Export enabled={true} />
            </PieChart>
          </div>
        );
      }
      
      case 'Pivot': {
        const pivotDataSource = new PivotGridDataSource({
          store: processedData.rawData,
          fields: [
            { 
              dataField: 'CompGroupId',
              area: 'row',
              expanded: true
            },
            { 
              dataField: 'DocDt',
              area: 'column',
              groupInterval: 'year',
              caption: 'Year'
            },
            { 
              dataField: 'Amount',
              dataType: 'number',
              summaryType: 'sum',
              area: 'data',
              format: {
                type: 'fixedPoint',
                precision: 2
              }
            },
            {
              dataField: 'GLCode',
              area: 'filter'
            }
          ]
        });
        
        return (
          <div className="border rounded shadow-md h-full" key={componentName}>
            <h2 className="text-xl font-bold mb-2">{config.Name || 'Financial Analysis'}</h2>
            <PivotGrid
              id={componentName}
              dataSource={pivotDataSource}
              allowSortingBySummary={true}
              allowSorting={true}
              allowFiltering={true}
              allowExpandAll={true}
              height={350}
              showBorders={true}
              showTotalsPrior="none"
              showColumnGrandTotals={true}
              showRowGrandTotals={true}
            >
              <FieldChooser enabled={true} />
            </PivotGrid>
          </div>
        );
      }
      
      default:
        console.warn(`Unknown component type: ${componentType}`);
        return null;
    }
  };
  
  // Recursively render layout groups and items based on the XML structure
  const renderLayoutGroup = (group: LayoutGroup, groupIndex: number): ReactElement => {
    const isVertical = (group.$?.Orientation?.toLowerCase() || 'horizontal') === 'vertical';
    const groupStyle = isVertical 
      ? { display: 'flex', flexDirection: 'column' as const, gap: '1rem', height: '100%' }
      : { display: 'flex', flexDirection: 'row' as const, gap: '1rem', height: '100%' };
    
    // Calculate weight percentages
    const totalWeight = (() => {
      let weight = 0;
      
      if (group.LayoutItem && Array.isArray(group.LayoutItem)) {
        group.LayoutItem.forEach(item => {
          if (item.$ && item.$.Weight) {
            weight += parseFloat(item.$.Weight);
          }
        });
      }
      
      if (group.LayoutGroup && Array.isArray(group.LayoutGroup)) {
        group.LayoutGroup.forEach(childGroup => {
          if (childGroup.$ && childGroup.$.Weight) {
            weight += parseFloat(childGroup.$.Weight);
          }
        });
      }
      
      return weight > 0 ? weight : 100;
    })();
    
    // Render layout items
    const items: ReactElement[] = [];
    
    if (group.LayoutItem && Array.isArray(group.LayoutItem)) {
      group.LayoutItem.forEach((item, itemIndex) => {
        if (item.$ && item.$.DashboardItem) {
          const weight = parseFloat(item.$.Weight || '0');
          const flexBasis = `${(weight / totalWeight) * 100}%`;
          
          const component = createComponent(item.$.DashboardItem);
          if (component) {
            items.push(
              <div 
                key={`item-${item.$.DashboardItem}-${itemIndex}`} 
                style={{ flex: `0 0 ${flexBasis}` }}
                className="h-full"
              >
                {component}
              </div>
            );
          }
        }
      });
    }
    
    // Render nested layout groups
    if (group.LayoutGroup && Array.isArray(group.LayoutGroup)) {
      group.LayoutGroup.forEach((childGroup, childIndex) => {
        const weight = parseFloat(childGroup.$?.Weight || '0');
        const flexBasis = `${(weight / totalWeight) * 100}%`;
        
        items.push(
          <div 
            key={`group-${groupIndex}-${childIndex}`} 
            style={{ flex: `0 0 ${flexBasis}` }}
            className="h-full"
          >
            {renderLayoutGroup(childGroup, childIndex)}
          </div>
        );
      });
    }
    
    return (
      <div 
        style={groupStyle} 
        className="w-full h-full" 
        key={`group-container-${groupIndex}`}
      >
        {items}
      </div>
    );
  };

  // Main render function
  const renderDashboard = () => {
    if (loading) return <div className="p-4">Loading charts...</div>;
    if (error) return <div className="p-4 text-red-500">Error: {error}</div>;
    if (!dashboardData || !processedData || !layoutTree) {
      return <div className="p-4">No data or layout information available</div>;
    }
    
    // If we have layout information, render the dashboard based on the layout tree
    if (layoutTree.LayoutGroup && Array.isArray(layoutTree.LayoutGroup) && layoutTree.LayoutGroup.length > 0) {
      return renderLayoutGroup(layoutTree.LayoutGroup[0], 0);
    }
    
    // Fallback: If there's no layout tree, show a warning
    return <div className="p-4 text-yellow-500">No layout structure found in XML</div>;
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Financial Dashboard</h1>
      
      <div className="dashboard-container" style={{ height: '850px' }}>
        {renderDashboard()}
      </div>
 </div>
  );
}
