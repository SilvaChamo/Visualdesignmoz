'use client'

import { useI18n } from '@/lib/i18n'
import Image from 'next/image'
import { Clock, Tag } from 'lucide-react'

export default function CoursesPage() {
  const { t } = useI18n()

  const courses = [
    {
      title: "Web Design Profissional",
      desc: "Aprenda a criar websites modernos, responsivos e otimizados usando as melhores práticas do mercado.",
      price: "MZN 5.000",
      duration: "8 Semanas",
      image: "/assets/Portfolio-FqaDr0sCVpVxSNTK9HoooA.jpg"
    },
    {
      title: "Design Gráfico & Branding",
      desc: "Domine as ferramentas Adobe e aprenda a criar identidades visuais impactantes e manuais de marca.",
      price: "MZN 4.500",
      duration: "8 Semanas",
      image: "/assets/mltmark-yz7SQt6lzOCz3rdLcBegBg.jpg"
    },
    {
      title: "Marketing Digital & E-commerce",
      desc: "Estratégias de tráfego pago, gestão de redes sociais e como criar lojas online de sucesso.",
      price: "MZN 6.000",
      duration: "10 Semanas",
      image: "/assets/Doce-Xl1w27CrpQiIGFCVayQWAQ.jpg"
    }
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Hero Section Standardized */}
      <div className="bg-[#404040] relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">{t('courses.title')}</h1>
            <p className="text-base text-white font-normal max-w-2xl mx-auto">
              {t('courses.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Courses Content */}
      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {courses.map((course, index) => (
              <div key={index} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <div className="relative h-48 w-full bg-slate-200">
                    <Image
                      src={course.image}
                      alt={course.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{course.title}</h3>
                    <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                      {course.desc}
                    </p>
                    
                    <div className="flex items-center justify-between text-sm text-slate-500 mb-4">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1 text-red-500" />
                        {course.duration}
                      </div>
                      <div className="flex items-center font-bold text-red-600 text-base">
                        <Tag className="w-4 h-4 mr-1 text-red-500" />
                        {course.price}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 pt-0">
                  <button className="w-fit bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors self-start">
                    Inscrever-me
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
