'use client';

import { PageHeader } from '@/components/admin/PageHeader';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/shadcn/tabs';
import { useSettings } from '@/lib/api/admin/settings';

import { ContactTab } from './ContactTab';
import { FooterTab } from './FooterTab';
import { HeaderTab } from './HeaderTab';
import { IdentityTab } from './IdentityTab';
import { SeoTab } from './SeoTab';
import { SocialTab } from './SocialTab';

const TABS = [
  { value: 'identity', label: 'Identitas' },
  { value: 'footer', label: 'Footer' },
  { value: 'contact', label: 'Kontak' },
  { value: 'social', label: 'Sosial media' },
  { value: 'seo', label: 'SEO' },
  { value: 'header', label: 'Header' },
] as const;

/** Site-wide settings (docs 07 §3.11): six tabs, each its own key of `site_settings`. */
export function SettingsView() {
  const { data, isLoading } = useSettings();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pengaturan situs"
        description="Identitas, kontak, tautan sosial, dan SEO default yang tampil di situs publik."
      />
      {isLoading ? null : (
        <Tabs defaultValue="identity">
          <div className="no-scrollbar -mx-4 overflow-x-auto overflow-y-hidden px-4 max-md:[mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)] md:mx-0 md:px-0">
            <TabsList
              variant="line"
              className="h-11 w-max justify-start md:h-10 md:w-full"
            >
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="h-10 flex-none px-3 md:flex-1"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="identity" className="pt-2">
            <IdentityTab value={data?.['site.identity']} />
          </TabsContent>
          <TabsContent value="footer" className="pt-2">
            <FooterTab value={data?.['site.footer']} />
          </TabsContent>
          <TabsContent value="contact" className="pt-2">
            <ContactTab value={data?.['site.contact']} />
          </TabsContent>
          <TabsContent value="social" className="pt-2">
            <SocialTab value={data?.['site.social']} />
          </TabsContent>
          <TabsContent value="seo" className="pt-2">
            <SeoTab value={data?.['seo.defaults']} />
          </TabsContent>
          <TabsContent value="header" className="pt-2">
            <HeaderTab value={data?.['header.options']} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
